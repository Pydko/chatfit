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

// Thrown when the daily user limit or YouTube quota is exhausted
export class VideoLimitError extends Error {}

const REQUEST_TIMEOUT_MS = 15_000;

// Do not request again for the same exercise + language as long as the app is open.
// The server already has a 30-day cache; this simply prevents unnecessary network traffic.
const memoryCache = new Map<string, VideoSearchResponse>();

type SearchBody =
  | { exercise_id: string; lang: VideoLang }
  | { query: string; lang: VideoLang };

async function callVideoSearch(body: SearchBody): Promise<VideoSearchResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Session not found.');

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
        throw new Error('Video service did not respond. Try again.');
      }
      throw new Error('Could not reach the server. Check your internet connection.');
    }

    const payload: unknown = await response.json().catch(() => null);
    const serverError = (payload as { error?: string } | null)?.error;

    // 429: user/global daily limit, 503: YouTube quota
    if (response.status === 429 || response.status === 503) {
      throw new VideoLimitError(serverError ?? 'Video search limit reached. Try again tomorrow.');
    }

    if (!response.ok) {
      throw new Error(serverError ?? `Could not fetch videos (code: ${response.status}).`);
    }

    const parsed = searchResponseSchema.safeParse(payload);
    if (!parsed.success) {
      console.log('VIDEO PARSE ERROR:', parsed.error.issues);
      throw new Error('Received an unexpected response from the video service.');
    }

    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

function remember(key: string, data: VideoSearchResponse) {
  // Do not store stale or empty results; retry on next launch
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

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}