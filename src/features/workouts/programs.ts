import { supabase } from '@/lib/supabase';
import type { WorkoutSession } from '@/types/workout';

export type Program = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
};

export type ProgramDay = {
  id: string;
  program_id: string;
  day_index: number;
  name: string;
};

export type ProgramDayExercise = {
  id: string;
  program_day_id: string;
  exercise_id: string;
  position: number;
  target_sets: number | null;
  target_reps: number | null;
  last_note: string | null;
  last_note_at: string | null;
};

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Session not found.');
  return id;
}

export async function fetchActiveProgram(): Promise<Program | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('is_active', true)
    .order('created_at')
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

// Silently creates one if no active program exists; the user doesn't have to deal with the "program" concept.
export async function ensureActiveProgram(): Promise<Program> {
  const existing = await fetchActiveProgram();
  if (existing) return existing;
  return createProgram('My Workouts');
}

export async function createProgram(name: string): Promise<Program> {
  const userId = await uid();
  const { data, error } = await supabase
    .from('programs')
    .insert({ user_id: userId, name })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function renameProgram(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('programs').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteProgram(id: string): Promise<void> {
  const { error } = await supabase.from('programs').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchProgramDays(programId: string): Promise<ProgramDay[]> {
  const { data, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('program_id', programId)
    .order('day_index');

  if (error) throw error;
  return data ?? [];
}

export async function addProgramDay(programId: string, name?: string): Promise<ProgramDay> {
  const userId = await uid();
  const existing = await fetchProgramDays(programId);
  const nextIndex = existing.length + 1;

  const { data, error } = await supabase
    .from('program_days')
    .insert({
      user_id: userId,
      program_id: programId,
      day_index: nextIndex,
      name: name?.trim() || `Workout ${nextIndex}`,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function renameProgramDay(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('program_days').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteProgramDay(id: string): Promise<void> {
  const { error } = await supabase.from('program_days').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchDayExercises(dayId: string): Promise<ProgramDayExercise[]> {
  const { data, error } = await supabase
    .from('program_day_exercises')
    .select('*')
    .eq('program_day_id', dayId)
    .order('position');

  if (error) throw error;
  return data ?? [];
}

export async function fetchDayExerciseById(id: string): Promise<ProgramDayExercise | null> {
  const { data, error } = await supabase
    .from('program_day_exercises')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

export async function addExerciseToDay(input: {
  program_day_id: string;
  exercise_id: string;
  target_sets?: number | null;
  target_reps?: number | null;
}): Promise<ProgramDayExercise> {
  const userId = await uid();
  const existing = await fetchDayExercises(input.program_day_id);

  const { data, error } = await supabase
    .from('program_day_exercises')
    .insert({
      user_id: userId,
      program_day_id: input.program_day_id,
      exercise_id: input.exercise_id,
      position: existing.length + 1,
      target_sets: input.target_sets ?? null,
      target_reps: input.target_reps ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeExerciseFromDay(id: string): Promise<void> {
  const { error } = await supabase.from('program_day_exercises').delete().eq('id', id);
  if (error) throw error;
}

export async function updateDayExerciseTargets(
  id: string,
  targets: { target_sets: number | null; target_reps: number | null },
): Promise<void> {
  const { error } = await supabase
    .from('program_day_exercises')
    .update(targets)
    .eq('id', id);
  if (error) throw error;
}

// User's manually written free-form note: e.g. "did 3 sets of 60 kg last time".
export async function updateDayExerciseNote(id: string, note: string): Promise<void> {
  const trimmed = note.trim();
  const { error } = await supabase
    .from('program_day_exercises')
    .update({
      last_note: trimmed || null,
      last_note_at: trimmed ? new Date().toISOString() : null,
    })
    .eq('id', id);

  if (error) throw error;
}

// Return the one after the day of the last performed programmed session

export async function startSessionForDay(day: ProgramDay) {
  const userId = await uid();
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({ user_id: userId, title: day.name, program_day_id: day.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function findTodaySessionForDay(programDayId: string): Promise<WorkoutSession | null> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('program_day_id', programDayId)
    .gte('performed_at', startOfDay.toISOString())
    .order('performed_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}