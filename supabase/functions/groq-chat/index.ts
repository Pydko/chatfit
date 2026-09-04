import { createClient } from 'jsr:@supabase/supabase-js@2';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const DAILY_MESSAGE_LIMIT = 40;
const CONTEXT_MESSAGE_COUNT = 12;
const MAX_MESSAGE_LENGTH = 2000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT =
  'Sen ChatFit uygulamasinin antrenman kocusun. Kullanicilara antrenman, beslenme ve motivasyon konularinda kisa, samimi ve pratik tavsiyeler ver. Turkce konus. Tibbi teshis koyma; ciddi saglik sorunlarinda bir uzmana danismasini oner. Cevaplarini kisa ve net tut.';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Oturum bulunamadi.' }, 401);
  }

  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  if (!groqApiKey) {
    return jsonResponse({ error: 'Sunucu yapilandirma hatasi.' }, 500);
  }

  let body: { thread_id?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Gecersiz istek govdesi.' }, 400);
  }

  const threadId = body.thread_id;
  const message = body.message?.trim();

  if (!threadId || !message) {
    return jsonResponse({ error: 'thread_id ve message zorunlu.' }, 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return jsonResponse({ error: 'Mesaj cok uzun.' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Oturum gecersiz.' }, 401);
  }
  const userId = userData.user.id;

  const { data: thread, error: threadError } = await supabase
    .from('chat_threads')
    .select('id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  if (threadError || !thread) {
    return jsonResponse({ error: 'Sohbet bulunamadi.' }, 404);
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', since);

  if (countError) {
    return jsonResponse({ error: 'Limit kontrolu basarisiz.' }, 500);
  }
  if ((count ?? 0) >= DAILY_MESSAGE_LIMIT) {
    return jsonResponse(
      { error: `Gunluk mesaj limitine (${DAILY_MESSAGE_LIMIT}) ulastin. Yarin tekrar dene.` },
      429,
    );
  }

  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(CONTEXT_MESSAGE_COUNT);

  const contextMessages = (history ?? [])
    .slice()
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));

  const { error: insertUserError } = await supabase.from('chat_messages').insert({
    thread_id: threadId,
    user_id: userId,
    role: 'user',
    content: message,
  });
  if (insertUserError) {
    return jsonResponse({ error: 'Mesaj kaydedilemedi.' }, 500);
  }

  const groqResponse = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      stream: true,
      temperature: 0.6,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...contextMessages,
        { role: 'user', content: message },
      ],
    }),
  });

  if (!groqResponse.ok || !groqResponse.body) {
    const errText = await groqResponse.text().catch(() => '');
    console.log('GROQ ERROR:', groqResponse.status, errText);
    return jsonResponse({ error: 'Yapay zeka servisine ulasilamadi.' }, 502);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let fullText = '';

  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content;
          if (token) {
            fullText += token;
            controller.enqueue(encoder.encode(token));
          }
        } catch {
          // yarim JSON parcasi olabilir, yoksay
        }
      }
    },
    async flush() {
      if (fullText.trim().length > 0) {
        await supabase.from('chat_messages').insert({
          thread_id: threadId,
          user_id: userId,
          role: 'assistant',
          content: fullText.trim(),
        });
      }
    },
  });

  groqResponse.body.pipeTo(stream.writable).catch((e) => {
    console.log('STREAM PIPE ERROR:', e);
  });

  return new Response(stream.readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
});