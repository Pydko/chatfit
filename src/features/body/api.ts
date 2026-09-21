import { supabase } from '@/lib/supabase';
import type { BodyMetric } from '@/types/body';
import { localIsoDate, type BodyMetricInput } from './schemas';

const SELECT_COLS = 'id, user_id, measured_on, weight_kg, body_fat_pct, created_at';

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Session not found.');
  return id;
}

// Numeric columns might come as strings; convert to number before calculations
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalize(row: any): BodyMetric {
  return {
    id: row.id,
    user_id: row.user_id,
    measured_on: row.measured_on,
    weight_kg: toNumberOrNull(row.weight_kg),
    body_fat_pct: toNumberOrNull(row.body_fat_pct),
    created_at: row.created_at,
  };
}

// Oldest to newest by date. Trend calculations expect this order.
export async function fetchBodyMetrics(days = 180): Promise<BodyMetric[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('body_metrics')
    .select(SELECT_COLS)
    .gte('measured_on', localIsoDate(since))
    .order('measured_on', { ascending: true })
    .limit(400);

  if (error) throw error;
  return (data ?? []).map(normalize);
}

// A second entry on the same day updates that day's measurement instead of creating a new row
// (unique user_id + measured_on). Blank fields are written as null,
// so the screen must pre-fill the form with that day's existing values.
export async function saveBodyMetric(input: BodyMetricInput): Promise<BodyMetric> {
  const userId = await uid();

  const { data, error } = await supabase
    .from('body_metrics')
    .upsert({ user_id: userId, ...input }, { onConflict: 'user_id,measured_on' })
    .select(SELECT_COLS)
    .single();

  if (error) throw error;
  return normalize(data);
}

export async function deleteBodyMetric(id: string): Promise<void> {
  const { error } = await supabase.from('body_metrics').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchHeightCm(): Promise<number | null> {
  const userId = await uid();

  const { data, error } = await supabase
    .from('profiles')
    .select('height_cm')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return toNumberOrNull(data?.height_cm);
}

export async function saveHeightCm(heightCm: number): Promise<void> {
  const userId = await uid();

  const { error } = await supabase
    .from('profiles')
    .update({ height_cm: heightCm })
    .eq('id', userId);

  if (error) throw error;
}