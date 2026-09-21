import type { SetLog } from '@/types/workout';

// "3 sets x 12 reps" or if reps vary "3 sets (12, 10, 8)"
export function summarizeSets(sets: SetLog[]): string {
  const working = sets.filter((s) => !s.is_warmup);
  if (working.length === 0) return 'Warmup only';

  const reps = working.map((s) => s.reps);
  const allSame = reps.every((r) => r === reps[0]);

  return allSame
    ? `${working.length} sets x ${reps[0]} reps`
    : `${working.length} sets (${reps.join(', ')})`;
}

// "60 kg" or if weight changes "60-70 kg"
export function summarizeWeight(sets: SetLog[]): string {
  const working = sets.filter((s) => !s.is_warmup);
  if (working.length === 0) return '';

  const weights = working.map((s) => s.weight_kg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);

  return min === max ? `${min} kg` : `${min}-${max} kg`;
}

// Generic: Extended types like LocalSetLog are preserved after grouping.
export function groupByExercise<T extends { exercise_id: string }>(
  sets: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const set of sets) {
    const list = map.get(set.exercise_id) ?? [];
    list.push(set);
    map.set(set.exercise_id, list);
  }
  return map;
}

export function groupBySession<T extends { session_id: string }>(
  sets: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const set of sets) {
    const list = map.get(set.session_id) ?? [];
    list.push(set);
    map.set(set.session_id, list);
  }
  return map;
}