import { supabase } from '@/lib/supabase';
import type { StatSession, StatSet } from './summary';

export type StatsData = {
  sets: StatSet[];
  sessions: StatSession[];
};

const EMPTY: StatsData = { sets: [], sessions: [] };

/**
 * Fetches set and session logs for the last N days.
 * Thanks to RLS, only the user's own rows are returned.
 * Does not throw an error when offline, returns empty data instead.
 */
export async function fetchStatsData(days = 28): Promise<StatsData> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    const [setsRes, sessionsRes] = await Promise.all([
      supabase
        .from('set_logs')
        .select('session_id, exercise_id, weight_kg, reps, is_warmup, performed_at')
        .gte('performed_at', since),
      supabase
        .from('workout_sessions')
        .select('id, performed_at')
        .gte('performed_at', since),
    ]);

    if (setsRes.error || sessionsRes.error) return EMPTY;

    const sets: StatSet[] = (setsRes.data ?? []).map((row) => ({
      session_id: row.session_id as string,
      exercise_id: row.exercise_id as string,
      weight_kg: Number(row.weight_kg),
      reps: Number(row.reps),
      is_warmup: Boolean(row.is_warmup),
      performed_at: row.performed_at as string,
    }));

    const sessions: StatSession[] = (sessionsRes.data ?? []).map((row) => ({
      id: row.id as string,
      performed_at: row.performed_at as string,
    }));

    return { sets, sessions };
  } catch {
    return EMPTY;
  }
}