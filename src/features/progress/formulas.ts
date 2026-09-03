import type { SetLog } from '@/types/workout';

/**
 * Tahmini 1RM (bir tekrarlik maksimum).
 *
 * Epley: w * (1 + r/30)  - yuksek tekrarlarda daha isabetli
 * Brzycki: w * 36 / (37 - r)  - dusuk tekrarlarda daha isabetli
 *
 * Ikisinin ortalamasini aliyoruz; tek formule guvenmek uc degerlerde sapiyor.
 * 12 tekrarin uzerinde her iki formul de guvenilirligini kaybeder.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;

  const epley = weightKg * (1 + reps / 30);
  const brzycki = reps < 37 ? (weightKg * 36) / (37 - reps) : epley;

  return round(( epley + brzycki) / 2);
}

/** Tahmin ne kadar guvenilir? Tekrar sayisi arttikca duser. */
export function oneRepMaxConfidence(reps: number): 'high' | 'medium' | 'low' {
  if (reps <= 5) return 'high';
  if (reps <= 10) return 'medium';
  return 'low';
}

/** Verilen 1RM ile hedef tekrar sayisinda kaldirilabilecek agirlik. */
export function weightForReps(oneRepMax: number, reps: number): number {
  if (oneRepMax <= 0 || reps <= 0) return 0;
  if (reps === 1) return round(oneRepMax);

  const epley = oneRepMax / (1 + reps / 30);
  const brzycki = (oneRepMax * (37 - reps)) / 36;

  return round((epley + brzycki) / 2);
}

/** Bir seansin en iyi setini (en yuksek tahmini 1RM) bul. */
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

/** Toplam tonaj: agirlik x tekrar toplami. Hacim gostergesi. */
export function totalTonnage(sets: SetLog[]): number {
  return round(
    sets
      .filter((s) => !s.is_warmup)
      .reduce((sum, s) => sum + s.weight_kg * s.reps, 0),
  );
}

/** Calisma seti sayisi - hacmin diger olcusu. */
export function workingSetCount(sets: SetLog[]): number {
  return sets.filter((s) => !s.is_warmup).length;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Salonda bulunabilecek en yakin agirliga yuvarla. */
export function roundToPlate(weightKg: number, increment = 2.5): number {
  if (weightKg <= 0) return 0;
  return Math.round(weightKg / increment) * increment;
}
