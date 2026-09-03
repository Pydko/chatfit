import type { SetLog } from '@/types/workout';
import { estimateOneRepMax, roundToPlate, weightForReps } from './formulas';

export type ProgressionSuggestion = {
  action: 'increase_weight' | 'add_reps' | 'hold' | 'deload' | 'no_data';
  weightKg: number;
  reps: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
};

export type ProgressionInput = {
  /** Bu hareketin son seansindaki calisma setleri */
  lastSessionSets: SetLog[];
  /** Onceki seanslarin setleri (yeniden eskiye) */
  previousSessions: SetLog[][];
  /** Hedef tekrar araligi */
  targetRepsMin?: number;
  targetRepsMax?: number;
  /** Agirlik artis adimi (barbell 2.5, dumbbell genelde 2) */
  increment?: number;
};

/**
 * Double progression mantigi:
 * - Tum setlerde hedef araligin ustune cikildiysa -> agirligi artir, alt sinira don
 * - Aralik icindeyse -> tekrar eklemeye devam et
 * - Alt sinirin altina dusuldiyse -> ayni agirlikta kal
 * - Ust uste 3 seans gerileme varsa -> deload oner
 */
export function suggestProgression(input: ProgressionInput): ProgressionSuggestion {
  const {
    lastSessionSets,
    previousSessions = [],
    targetRepsMin = 8,
    targetRepsMax = 12,
    increment = 2.5,
  } = input;

  const working = lastSessionSets.filter((s) => !s.is_warmup);

  if (working.length === 0) {
    return {
      action: 'no_data',
      weightKg: 0,
      reps: targetRepsMin,
      reason: 'Bu hareket icin henuz kayit yok.',
      confidence: 'low',
    };
  }

  const topWeight = Math.max(...working.map((s) => s.weight_kg));
  const setsAtTopWeight = working.filter((s) => s.weight_kg === topWeight);
  const minReps = Math.min(...setsAtTopWeight.map((s) => s.reps));
  const avgReps =
    setsAtTopWeight.reduce((sum, s) => sum + s.reps, 0) / setsAtTopWeight.length;

  // Gerileme kontrolu: son 3 seansin en iyi 1RM'i suruyor mu dusuyor mu
  if (previousSessions.length >= 2) {
    const maxes = [working, ...previousSessions.slice(0, 2)].map((sets) => {
      const w = sets.filter((s) => !s.is_warmup);
      if (w.length === 0) return 0;
      return Math.max(...w.map((s) => estimateOneRepMax(s.weight_kg, s.reps)));
    });

    const declining = maxes[0] < maxes[1] && maxes[1] < maxes[2] && maxes[2] > 0;
    if (declining) {
      return {
        action: 'deload',
        weightKg: roundToPlate(topWeight * 0.9, increment),
        reps: targetRepsMax,
        reason:
          'Son uc seansta performans dustu. Agirligi %10 azaltip toparlanmayi denemek mantikli olabilir.',
        confidence: 'medium',
      };
    }
  }

  // Tum setler hedef araligin ustunde -> agirlik artir
  if (minReps >= targetRepsMax) {
    const newWeight = roundToPlate(topWeight + increment, increment);
    return {
      action: 'increase_weight',
      weightKg: newWeight,
      reps: targetRepsMin,
      reason: `Tum setlerde ${targetRepsMax} tekrari tamamladin. Agirligi ${increment} kg artirmayi deneyebilirsin.`,
      confidence: 'high',
    };
  }

  // Aralik icinde -> tekrar ekle
  if (minReps >= targetRepsMin) {
    return {
      action: 'add_reps',
      weightKg: topWeight,
      reps: Math.min(Math.ceil(avgReps) + 1, targetRepsMax),
      reason: `Ayni agirlikta tekrar sayisini artirmaya calis. Hedef: her sette ${targetRepsMax} tekrar.`,
      confidence: 'high',
    };
  }

  // Alt sinirin altinda -> sabit kal
  return {
    action: 'hold',
    weightKg: topWeight,
    reps: targetRepsMin,
    reason: `Henuz ${targetRepsMin} tekrara ulasmadin. Ayni agirlikta kalip tekrar sayisini yukseltmeye odaklan.`,
    confidence: 'high',
  };
}

/** Belirli bir hedef tekrar icin agirlik onerisi (1RM uzerinden) */
export function suggestWeightForTargetReps(
  sets: SetLog[],
  targetReps: number,
): number {
  const working = sets.filter((s) => !s.is_warmup);
  if (working.length === 0) return 0;

  const best = Math.max(...working.map((s) => estimateOneRepMax(s.weight_kg, s.reps)));
  return roundToPlate(weightForReps(best, targetReps));
}
