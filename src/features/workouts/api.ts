import { supabase } from '@/lib/supabase';
import type { Exercise, SetLog, WorkoutSession } from '@/types/workout';

export async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, owner_id, name, primary_muscle, equipment, is_unilateral')
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export async function createExercise(input: {
  name: string;
  primary_muscle: string;
  equipment?: string | null;
}): Promise<Exercise> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Oturum bulunamadi.');

  const { data, error } = await supabase
    .from('exercises')
    .insert({ ...input, owner_id: uid })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function startSession(title?: string): Promise<WorkoutSession> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Oturum bulunamadi.');

  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({ user_id: uid, title: title ?? null })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchSessions(limit = 30): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, user_id, performed_at, title, notes, duration_minutes')
    .order('performed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function fetchSetLogs(sessionId: string): Promise<SetLog[]> {
  const { data, error } = await supabase
    .from('set_logs')
    .select('*')
    .eq('session_id', sessionId)
    .order('performed_at');

  if (error) throw error;
  return data ?? [];
}

export async function addSetLog(input: {
  session_id: string;
  exercise_id: string;
  set_index: number;
  weight_kg: number;
  reps: number;
  rpe?: number | null;
  is_warmup?: boolean;
}): Promise<SetLog> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Oturum bulunamadi.');

  const { data, error } = await supabase
    .from('set_logs')
    .insert({ ...input, user_id: uid })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSetLog(id: string): Promise<void> {
  const { error } = await supabase.from('set_logs').delete().eq('id', id);
  if (error) throw error;
}

// Bir hareketin son calisilan setleri - "gecen sefer ne yaptim" icin
export async function fetchLastSetsForExercise(
  exerciseId: string,
  limit = 5,
): Promise<SetLog[]> {
  const { data, error } = await supabase
    .from('set_logs')
    .select('*')
    .eq('exercise_id', exerciseId)
    .eq('is_warmup', false)
    .order('performed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
