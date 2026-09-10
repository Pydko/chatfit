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
  noteCount: number;      // sunucunun gercekten buldugu not sayisi
  noteTruncated: boolean; // baglam siniri asildi mi
};

export class DailyLimitError extends Error {}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Oturum bulunamadi.');
  return id;
}

// Her sohbet oturumu icin yeni bir thread. Eski thread'ler okunmuyor,
// gecmis ekranda gosterilmiyor - sadece limit kontrolu icin DB'de kaliyor.
export async function createNewThread(): Promise<ChatThread> {
  const userId = await uid();

  const { data, error } = await supabase
    .from('chat_threads')
    .insert({ user_id: userId, title: 'Sohbet' })
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
): Promise<SendResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Oturum bulunamadi.');

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
      // Not icerigi client'tan GONDERILMEZ - sadece id'ler.
      // Sunucu notlari kullanicinin JWT'siyle ceker, RLS devrede.
      body: JSON.stringify({ thread_id: threadId, message: content, note_ids: noteIds }),
    });
  } catch (e) {
    console.log('CHAT NETWORK ERROR:', e);
    throw new Error('Sunucuya ulasilamadi. Internet baglantini kontrol et.');
  }

  if (response.status === 429) {
    const errBody = await response.json().catch(() => null);
    throw new DailyLimitError(errBody?.error ?? 'Gunluk mesaj limitine ulastin.');
  }

  if (!response.ok || !response.body) {
    const errBody = await response.json().catch(() => null);
    throw new Error(errBody?.error ?? `Mesaj gonderilemedi (kod: ${response.status}).`);
  }

  const noteCount = Number(response.headers.get('x-note-count') ?? '0') || 0;
  const noteTruncated = response.headers.get('x-note-truncated') === '1';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    if (text) onToken(text);
  }

  return { noteCount, noteTruncated };
}