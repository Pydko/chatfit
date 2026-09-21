import type { BodySummary } from '@/features/body/summary';
import { supabase } from '@/lib/supabase';
import { fetch as expoFetch } from 'expo/fetch';

export type ChatThread = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type SendResult = {
  noteCount: number;      // Number of notes actually found by the server
  noteTruncated: boolean; // Whether the context limit was exceeded
  bodyContext: boolean;   // Whether the server included body data in the prompt
};

export class DailyLimitError extends Error {}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Session not found.');
  return id;
}

// A new thread for each chat session. Old threads are not read,
// history is not shown on screen - they only remain in DB for limit checks.
export async function createNewThread(): Promise<ChatThread> {
  const userId = await uid();

  const { data, error } = await supabase
    .from('chat_threads')
    .insert({ user_id: userId, title: 'Chat' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function sendMessageStream(
  threadId: string,
  content: string,
  onToken: (token: string) => void,
  noteIds: string[] = [],
  bodySummary: BodySummary | null = null,
): Promise<SendResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Session not found.');

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/groq-chat`;

  let response: Response;
  try {
    response = await expoFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      // Note contents are NOT sent from the client - only IDs.
      // Server fetches notes using the user's JWT, RLS is active.
      // Body data is sent only as values; prompt text is constructed by the server.
      body: JSON.stringify({
        thread_id: threadId,
        message: content,
        note_ids: noteIds,
        body_summary: bodySummary,
      }),
    });
  } catch (e) {
    console.log('CHAT NETWORK ERROR:', e);
    throw new Error('Could not reach the server. Check your internet connection.');
  }

  if (response.status === 429) {
    const errBody = await response.json().catch(() => null);
    throw new DailyLimitError(errBody?.error ?? 'You have reached your daily message limit.');
  }

  if (!response.ok || !response.body) {
    const errBody = await response.json().catch(() => null);
    throw new Error(errBody?.error ?? `Could not send message (code: ${response.status}).`);
  }

  const noteCount = Number(response.headers.get('x-note-count') ?? '0') || 0;
  const noteTruncated = response.headers.get('x-note-truncated') === '1';
  const bodyContext = response.headers.get('x-body-context') === '1';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    if (text) onToken(text);
  }

  return { noteCount, noteTruncated, bodyContext };
}