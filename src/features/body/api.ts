import { supabase } from '@/lib/supabase';
import type { BodyMetric } from '@/types/body';
import { localIsoDate, type BodyMetricInput } from './schemas';

const SELECT_COLS = 'id, user_id, measured_on, weight_kg, body_fat_pct, created_at';

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Oturum bulunamadi.');
  return id;
}

// numeric kolonlar string olarak gelebilir; hesaplamalara girmeden sayiya cevir
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

// Tarihe gore eskiden yeniye. Trend hesaplari bu sirayi bekliyor.
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

// Ayni gune ikinci kayit yeni satir acmaz, o gunun olcumunu gunceller
// (unique user_id + measured_on). Bos birakilan alan null olarak yazilir,
// bu yuzden ekran o gunun mevcut degerlerini forma doldurmali.
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