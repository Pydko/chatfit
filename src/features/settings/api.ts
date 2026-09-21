import { supabase } from '@/lib/supabase';
import type { UnitSystem } from './units';

export type UserSettings = {
  displayName: string | null;
  unitSystem: UnitSystem;
  defaultRestSeconds: number;
};

const DEFAULTS: UserSettings = {
  displayName: null,
  unitSystem: 'metric',
  defaultRestSeconds: 90,
};

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Session not found.');
  return id;
}

/** Returns with safe defaults when offline or if no row exists. */
export async function fetchSettings(): Promise<UserSettings> {
  try {
    const userId = await uid();

    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, unit_system, default_rest_seconds')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return DEFAULTS;

    return {
      displayName: (data.display_name as string | null) ?? null,
      unitSystem: (data.unit_system as UnitSystem) ?? 'metric',
      defaultRestSeconds: Number(data.default_rest_seconds ?? 90),
    };
  } catch {
    return DEFAULTS;
  }
}

/** Partial update: only the provided fields are written. */
export async function saveSettings(patch: {
  display_name?: string;
  unit_system?: UnitSystem;
  default_rest_seconds?: number;
}): Promise<void> {
  const userId = await uid();

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

/** Gather all user data into a single JSON string. Only own rows return thanks to RLS. */
export async function exportAllData(): Promise<string> {
  const [
    profile,
    sessions,
    sets,
    body,
    notes,
    programs,
    programDays,
    programDayExercises,
  ] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('workout_sessions').select('*'),
    supabase.from('set_logs').select('*'),
    supabase.from('body_metrics').select('*'),
    supabase.from('notes').select('*'),
    supabase.from('programs').select('*'),
    supabase.from('program_days').select('*'),
    supabase.from('program_day_exercises').select('*'),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profile.data ?? [],
    workout_sessions: sessions.data ?? [],
    set_logs: sets.data ?? [],
    body_metrics: body.data ?? [],
    notes: notes.data ?? [],
    programs: programs.data ?? [],
    program_days: programDays.data ?? [],
    program_day_exercises: programDayExercises.data ?? [],
  };

  return JSON.stringify(payload, null, 2);
}