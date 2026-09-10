import { supabase } from '@/lib/supabase';
import { z } from 'zod';

export type VideoLang = 'tr' | 'en';

const videoResultSchema = z.object({
  videoId: z.string().min(1),
  title: z.string(),
  channel: z.string(),
  thumbnail: z.string(),
  publishedAt: z.string(),
});

const searchResponseSchema = z.object({
  results: z.array(videoResultSchema),
  cached: z.boolean(),
  stale: z.boolean(),
  remaining: z.number().optional(),
});

export type VideoResult = z.infer<typeof videoResultSchema>;
export type VideoSearchResponse = z.infer<typeof searchResponseSchema>;

// Gunluk kullanici limiti veya YouTube kotasi doldugunda firlatilir
export class VideoLimitError extends Error {}

const REQUEST_TIMEOUT_MS = 15_000;

// Uygulama acik oldugu surece ayni hareket + dil icin tekrar istek atma.
// Sunucuda zaten 30 gunluk cache var; bu sadece gereksiz ag trafigini onler.
const memoryCache = new Map<string, VideoSearchResponse>();

type SearchBody =
  | { exercise_id: string; lang: VideoLang }
  | { query: string; lang: VideoLang };

async function callVideoSearch(body: SearchBody): Promise<VideoSearchResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Oturum bulunamadı.');

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/youtube-search`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      console.log('VIDEO NETWORK ERROR:', e);
      if (controller.signal.aborted) {
        throw new Error('Video servisi yanıt vermedi. Tekrar dene.');
      }
      throw new Error('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.');
    }

    const payload: unknown = await response.json().catch(() => null);
    const serverError = (payload as { error?: string } | null)?.error;

    // 429: kullanici/global gunluk limit, 503: YouTube kotasi
    if (response.status === 429 || response.status === 503) {
      throw new VideoLimitError(serverError ?? 'Video arama limiti doldu. Yarın tekrar dene.');
    }

    if (!response.ok) {
      throw new Error(serverError ?? `Videolar alınamadı (kod: ${response.status}).`);
    }

    const parsed = searchResponseSchema.safeParse(payload);
    if (!parsed.success) {
      console.log('VIDEO PARSE ERROR:', parsed.error.issues);
      throw new Error('Video servisinden beklenmeyen bir yanıt geldi.');
    }

    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

function remember(key: string, data: VideoSearchResponse) {
  // Bayat veya bos sonuclari saklama; bir sonraki acilista tekrar denensin
  if (data.results.length > 0 && !data.stale) {
    memoryCache.set(key, { ...data, cached: true, remaining: undefined });
  }
}

export async function searchVideosForExercise(
  exerciseId: string,
  lang: VideoLang = 'tr',
): Promise<VideoSearchResponse> {
  const key = `ex:${lang}:${exerciseId}`;
  const hit = memoryCache.get(key);
  if (hit) return hit;

  const data = await callVideoSearch({ exercise_id: exerciseId, lang });
  remember(key, data);
  return data;
}

export async function searchVideosByQuery(
  query: string,
  lang: VideoLang = 'tr',
): Promise<VideoSearchResponse> {
  const key = `q:${lang}:${query.trim().toLocaleLowerCase('tr')}`;
  const hit = memoryCache.get(key);
  if (hit) return hit;

  const data = await callVideoSearch({ query: query.trim(), lang });
  remember(key, data);
  return data;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}