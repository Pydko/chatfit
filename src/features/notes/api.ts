import {
  cacheRemoteNotes,
  enqueue,
  getLocalNote,
  getLocalNotes,
  removeLocalNote,
  saveLocalNote
} from '@/lib/local-db';
import { supabase } from '@/lib/supabase';
import { flushQueue } from '@/lib/sync';
import { uuidv4 } from '@/lib/uuid';

export type Note = {
  id: string;
  user_id: string;
  title: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export type LocalNote = Note & { is_pending: boolean };

const SELECT_COLS = 'id, user_id, title, body, created_at, updated_at';

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Session not found.');
  return id;
}

// Tries to fetch from server first, refreshes cache; falls back to
// local copy when offline. This function does not throw errors.
export async function fetchNotes(): Promise<LocalNote[]> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select(SELECT_COLS)
      .order('updated_at', { ascending: false })
      .limit(300);

    if (!error && data) {
      await cacheRemoteNotes(data as Note[]);
    }
  } catch {
    // Offline - use local copy
  }

  return (await getLocalNotes()) as LocalNote[];
}

export async function fetchNoteById(id: string): Promise<LocalNote | null> {
  const local = await getLocalNote(id);
  if (local) return local as LocalNote;

  try {
    const { data, error } = await supabase
      .from('notes')
      .select(SELECT_COLS)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    await saveLocalNote({ ...(data as Note), is_dirty: false });
    return { ...(data as Note), is_pending: false };
  } catch {
    return null;
  }
}

export async function createNote(input: {
  title: string | null;
  body: string;
}): Promise<LocalNote> {
  const userId = await uid();
  const now = new Date().toISOString();

  const row: Note = {
    id: uuidv4(),
    user_id: userId,
    title: input.title,
    body: input.body,
    created_at: now,
    updated_at: now,
  };

  await saveLocalNote({ ...row, is_dirty: true });
  await enqueue('upsert_note', row);
  flushQueue().catch(() => {});

  return { ...row, is_pending: true };
}

export async function updateNote(
  id: string,
  input: { title: string | null; body: string },
): Promise<LocalNote> {
  const existing = await getLocalNote(id);
  const userId = existing?.user_id ?? (await uid());
  const now = new Date().toISOString();

  const row: Note = {
    id,
    user_id: userId,
    title: input.title,
    body: input.body,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  await saveLocalNote({ ...row, is_dirty: true });
  await enqueue('upsert_note', row);
  flushQueue().catch(() => {});

  return { ...row, is_pending: true };
}

export const deleteNote = async (noteId: string) => {
  try {
    // Deletion process regardless of offline or online state
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting note:', error);
    return { success: false, error };
  }
};

// Clean up if deleted record still exists locally (for recovery after error)
export async function purgeLocalNote(id: string): Promise<void> {
  await removeLocalNote(id);
}

export function notePreview(body: string, max = 90): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}