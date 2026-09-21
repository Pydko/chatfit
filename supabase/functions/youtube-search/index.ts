import { createClient } from 'jsr:@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const YT_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

// YouTube free quota: 10,000 units/day, each search.list = 100 units -> 100 searches/day.
// Limit to 20 per user, 80 total globally; the remaining 20 units serve as a safety buffer.
const DAILY_USER_LIMIT = 20;
const DAILY_GLOBAL_LIMIT = 80;

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 60;
const MAX_RESULTS = 6;

// CORS: No wildcard. Native requests do not send an Origin header and remain unaffected.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:8081',
  'http://localhost:19006',
]);

type Lang = 'tr' | 'en';

type VideoResult = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  publishedAt: string;
};

function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>"'`\\|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Using a template instead of raw exercise names significantly improves search quality.
function buildSearchQuery(subject: string, lang: Lang): string {
  return lang === 'tr'
    ? `${subject} nasil yapilir dogru form`
    : `${subject} proper form technique`;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  const cors = buildCors(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, cors);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Session not found.' }, 401, cors);
  }

  const apiKey = Deno.env.get('YOUTUBE_API_KEY');
  if (!apiKey) {
    return json({ error: 'Server configuration error.' }, 500, cors);
  }

  let body: { exercise_id?: string; query?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400, cors);
  }

  const lang: Lang = body.lang === 'en' ? 'en' : 'tr';

  // User identity (RLS-enabled client)
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid session.' }, 401, cors);
  }
  const userId = userData.user.id;

  // Cache and counter tables are written using service_role
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // --- Determine search subject ---
  let subject = '';
  let exerciseId: string | null = null;

  if (body.exercise_id) {
    if (!UUID_RE.test(body.exercise_id)) {
      return json({ error: 'Invalid exercise ID.' }, 400, cors);
    }
    // Using userClient: thanks to RLS, restricted to global catalog + own exercises
    const { data: ex } = await userClient
      .from('exercises')
      .select('id, name')
      .eq('id', body.exercise_id)
      .maybeSingle();

    if (!ex) {
      return json({ error: 'Exercise not found.' }, 404, cors);
    }
    subject = ex.name as string;
    exerciseId = ex.id as string;
  } else if (typeof body.query === 'string') {
    subject = sanitizeQuery(body.query);
    if (subject.length < MIN_QUERY_LENGTH) {
      return json({ error: 'Search query is too short.' }, 400, cors);
    }
    if (subject.length > MAX_QUERY_LENGTH) {
      return json({ error: 'Search query is too long.' }, 400, cors);
    }
  } else {
    return json({ error: 'exercise_id or query is required.' }, 400, cors);
  }

  const queryKey = `${lang}:${subject.toLocaleLowerCase('tr')}`;

  // --- Cache ---
  const { data: cached } = await admin
    .from('exercise_videos')
    .select('results, fetched_at')
    .eq('query_key', queryKey)
    .maybeSingle();

  const cachedResults = (cached?.results ?? null) as VideoResult[] | null;
  const isFresh =
    cached && Date.now() - new Date(cached.fetched_at as string).getTime() < CACHE_TTL_MS;

  if (isFresh && cachedResults) {
    return json({ results: cachedResults, cached: true, stale: false }, 200, cors);
  }

  // If stale cache exists, we will fall back to it in case of quota/error conditions
  const fallback = cachedResults;

  // --- Rate limit ---
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: userCount, error: userCountError } = await admin
    .from('video_search_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);

  if (userCountError) {
    return json({ error: 'Limit check failed.' }, 500, cors);
  }
  if ((userCount ?? 0) >= DAILY_USER_LIMIT) {
    if (fallback) return json({ results: fallback, cached: true, stale: true }, 200, cors);
    return json(
      { error: `You have reached your daily video search limit (${DAILY_USER_LIMIT}). Try again tomorrow.` },
      429,
      cors,
    );
  }

  const { count: globalCount } = await admin
    .from('video_search_log')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since);

  if ((globalCount ?? 0) >= DAILY_GLOBAL_LIMIT) {
    if (fallback) return json({ results: fallback, cached: true, stale: true }, 200, cors);
    return json({ error: 'Video search service has reached its daily limit. Try again tomorrow.' }, 429, cors);
  }

  // --- YouTube ---
  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    type: 'video',
    q: buildSearchQuery(subject, lang),
    maxResults: String(MAX_RESULTS),
    order: 'relevance',
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
    relevanceLanguage: lang,
    regionCode: lang === 'tr' ? 'TR' : 'US',
  });

  let ytResponse: Response;
  try {
    ytResponse = await fetch(`${YT_SEARCH_URL}?${params.toString()}`);
  } catch (e) {
    console.log('YOUTUBE NETWORK ERROR:', e);
    if (fallback) return json({ results: fallback, cached: true, stale: true }, 200, cors);
    return json({ error: 'Could not reach the video service.' }, 502, cors);
  }

  if (!ytResponse.ok) {
    const errText = await ytResponse.text().catch(() => '');
    console.log('YOUTUBE ERROR:', ytResponse.status, errText);
    if (fallback) return json({ results: fallback, cached: true, stale: true }, 200, cors);
    if (ytResponse.status === 403) {
      return json({ error: 'Video search quota exhausted. Try again tomorrow.' }, 503, cors);
    }
    return json({ error: 'Video service encountered an error.' }, 502, cors);
  }

  const raw = await ytResponse.json();

  const results: VideoResult[] = (raw.items ?? [])
    .filter((item: any) => item?.id?.videoId && item?.snippet)
    .map((item: any) => ({
      videoId: item.id.videoId as string,
      title: decodeEntities(String(item.snippet.title ?? '')),
      channel: decodeEntities(String(item.snippet.channelTitle ?? '')),
      thumbnail: String(
        item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
      ),
      publishedAt: String(item.snippet.publishedAt ?? ''),
    }));

  // Search took place, quota was spent -> log in all cases
  await admin.from('video_search_log').insert({
    user_id: userId,
    query: subject.slice(0, 120),
  });

  if (results.length > 0) {
    await admin.from('exercise_videos').upsert(
      {
        query_key: queryKey,
        exercise_id: exerciseId,
        lang,
        query: subject.slice(0, 120),
        results,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'query_key' },
    );
  }

  return json(
    {
      results,
      cached: false,
      stale: false,
      remaining: Math.max(0, DAILY_USER_LIMIT - (userCount ?? 0) - 1),
    },
    200,
    cors,
  );
});