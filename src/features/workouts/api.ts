import { supabase } from '@/lib/supabase';
import { enqueue, savePendingSet, getPendingSets, removePendingSet } from '@/lib/local-db';
import { flushQueue } from '@/lib/sync';
import type { Exercise, SetLog, WorkoutSession } from '@/types/workout';

export type LocalSetLog = SetLog & { is_pending?: boolean };

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Oturum bulunamadi.');
  return id;
}

export async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, owner_id, name, primary_muscle, equipment, is_unilateral')
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export async function fetchExerciseById(id: string): Promise<Exercise | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, owner_id, name, primary_muscle, equipment, is_unilateral')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createExercise(input: {
  name: string;
  primary_muscle: string;
  equipment?: string | null;
}): Promise<Exercise> {
  const userId = await uid();
  const { data, error } = await supabase
    .from('exercises')
    .insert({ ...input, owner_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function startSession(title?: string): Promise<WorkoutSession> {
  const userId = await uid();
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({ user_id: userId, title: title ?? null })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchSessions(limit = 30): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, user_id, performed_at, title, notes, duration_minutes, program_day_id')
    .order('performed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// Sunucudaki setler + henuz gonderilmemis yerel setler.
// Bu fonksiyon asla hata firlatmaz - cevrimdisiyken yerel kayitlari doner.
export async function fetchSetLogs(sessionId: string): Promise<LocalSetLog[]> {
  let pending: LocalSetLog[] = [];
  try {
    pending = (await getPendingSets(sessionId)) as LocalSetLog[];
  } catch {
    pending = [];
  }

  let remote: SetLog[] = [];
  try {
    const { data, error } = await supabase
      .from('set_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('performed_at');
    if (!error) remote = data ?? [];
  } catch {
    // Cevrimdisi - sadece yerel kayitlar gosterilir
  }

  return [...remote, ...pending].sort(
    (a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime(),
  );
}

// Once yerele yaz, sonra gondermeyi dene. Cevrimdisiyken de calisir.
export async function addSetLog(input: {
  session_id: string;
  exercise_id: string;
  set_index: number;
  weight_kg: number;
  reps: number;
  rpe?: number | null;
  is_warmup?: boolean;
}): Promise<LocalSetLog> {
  const userId = await uid();
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const performedAt = new Date().toISOString();

  const row = {
    user_id: userId,
    session_id: input.session_id,
    exercise_id: input.exercise_id,
    set_index: input.set_index,
    weight_kg: input.weight_kg,
    reps: input.reps,
    rpe: input.rpe ?? null,
    is_warmup: input.is_warmup ?? false,
    performed_at: performedAt,
  };

  await savePendingSet({ local_id: localId, ...row });
  await enqueue('insert_set_log', { local_id: localId, ...row });

  flushQueue().catch(() => {});

  return { id: localId, ...row, is_pending: true };
}

export async function deleteSetLog(id: string): Promise<void> {
  if (id.startsWith('local-')) {
    await removePendingSet(id);
    return;
  }

  await enqueue('delete_set_log', { id });
  flushQueue().catch(() => {});
}

export async function fetchLastSetsForExercise(
  exerciseId: string,
  limit = 5,
): Promise<SetLog[]> {
  try {
    const { data, error } = await supabase
      .from('set_logs')
      .select('*')
      .eq('exercise_id', exerciseId)
      .eq('is_warmup', false)
      .order('performed_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function fetchExerciseHistory(exerciseId: string): Promise<SetLog[]> {
  const { data, error } = await supabase
    .from('set_logs')
    .select('*')
    .eq('exercise_id', exerciseId)
    .order('performed_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}
