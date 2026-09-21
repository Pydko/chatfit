import type { SetLog } from '@/types/workout';

/**
 * Estimated 1RM (one-rep maximum).
 *
 * Epley: w * (1 + r/30) - more accurate for higher reps
 * Brzycki: w * 36 / (37 - r) - more accurate for lower reps
 *
 * We take the average of both; relying on a single formula skews at extreme values.
 * Both formulas lose reliability above 12 reps.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;

  const epley = weightKg * (1 + reps / 30);
  const brzycki = reps < 37 ? (weightKg * 36) / (37 - reps) : epley;

  return round((epley + brzycki) / 2);
}

/** How reliable is the estimate? Decreases as the rep count increases. */
export function oneRepMaxConfidence(reps: number): 'high' | 'medium' | 'low' {
  if (reps <= 5) return 'high';
  if (reps <= 10) return 'medium';
  return 'low';
}

/** Weight that can be lifted for a target rep count given a 1RM. */
export function weightForReps(oneRepMax: number, reps: number): number {
  if (oneRepMax <= 0 || reps <= 0) return 0;
  if (reps === 1) return round(oneRepMax);

  const epley = oneRepMax / (1 + reps / 30);
  const brzycki = (oneRepMax * (37 - reps)) / 36;

  return round((epley + brzycki) / 2);
}

/** Find the best set of a session (highest estimated 1RM). */
export function bestSetOf(sets: SetLog[]): SetLog | null {
  const working = sets.filter((s) => !s.is_warmup);
  if (working.length === 0) return null;

  return working.reduce((best, current) =>
    estimateOneRepMax(current.weight_kg, current.reps) >
    estimateOneRepMax(best.weight_kg, best.reps)
      ? current
      : best,
  );
}

/** Total tonnage: weight x reps total. Indicator of volume. */
export function totalTonnage(sets: SetLog[]): number {
  return round(
    sets
      .filter((s) => !s.is_warmup)
      .reduce((sum, s) => sum + s.weight_kg * s.reps, 0),
  );
}

/** Working set count - another measure of volume. */
export function workingSetCount(sets: SetLog[]): number {
  return sets.filter((s) => !s.is_warmup).length;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Round to the nearest plate available in the gym. */
export function roundToPlate(weightKg: number, increment = 2.5): number {
  if (weightKg <= 0) return 0;
  return Math.round(weightKg / increment) * increment;
}