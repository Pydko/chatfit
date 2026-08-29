import type { SetLog } from '@/types/workout';

// "3 set x 12 tekrar" ya da tekrarlar farkliysa "3 set (12, 10, 8)"
export function summarizeSets(sets: SetLog[]): string {
  const working = sets.filter((s) => !s.is_warmup);
  if (working.length === 0) return 'Sadece isinma';

  const reps = working.map((s) => s.reps);
  const allSame = reps.every((r) => r === reps[0]);

  return allSame
    ? `${working.length} set x ${reps[0]} tekrar`
    : `${working.length} set (${reps.join(', ')})`;
}

// "60 kg" ya da agirlik degistiyse "60-70 kg"
export function summarizeWeight(sets: SetLog[]): string {
  const working = sets.filter((s) => !s.is_warmup);
  if (working.length === 0) return '';

  const weights = working.map((s) => s.weight_kg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);

  return min === max ? `${min} kg` : `${min}-${max} kg`;
}

export function groupByExercise(sets: SetLog[]): Map<string, SetLog[]> {
  const map = new Map<string, SetLog[]>();
  for (const set of sets) {
    const list = map.get(set.exercise_id) ?? [];
    list.push(set);
    map.set(set.exercise_id, list);
  }
  return map;
}

export function groupBySession(sets: SetLog[]): Map<string, SetLog[]> {
  const map = new Map<string, SetLog[]>();
  for (const set of sets) {
    const list = map.get(set.session_id) ?? [];
    list.push(set);
    map.set(set.session_id, list);
  }
  return map;
}
