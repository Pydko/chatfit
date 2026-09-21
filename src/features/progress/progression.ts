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
  /** Working sets from the last session for this exercise */
  lastSessionSets: SetLog[];
  /** Sets from previous sessions (newest to oldest) */
  previousSessions: SetLog[][];
  /** Target rep range */
  targetRepsMin?: number;
  targetRepsMax?: number;
  /** Weight increment step (barbell 2.5, dumbbell usually 2) */
  increment?: number;
};

/**
 * Double progression logic:
 * - If all sets exceed the target range -> increase weight, return to lower bound
 * - If within range -> continue adding reps
 * - If below lower bound -> stay at the same weight
 * - If performance drops for 3 consecutive sessions -> suggest deload
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
      reason: 'No records for this exercise yet.',
      confidence: 'low',
    };
  }

  const topWeight = Math.max(...working.map((s) => s.weight_kg));
  const setsAtTopWeight = working.filter((s) => s.weight_kg === topWeight);
  const minReps = Math.min(...setsAtTopWeight.map((s) => s.reps));
  const avgReps =
    setsAtTopWeight.reduce((sum, s) => sum + s.reps, 0) / setsAtTopWeight.length;

  // Decline check: checking if the best 1RM of the last 3 sessions is trending up or down
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
          'Performance dropped in the last three sessions. It might be wise to reduce weight by 10% and attempt recovery.',
        confidence: 'medium',
      };
    }
  }

  // All sets above target range -> increase weight
  if (minReps >= targetRepsMax) {
    const newWeight = roundToPlate(topWeight + increment, increment);
    return {
      action: 'increase_weight',
      weightKg: newWeight,
      reps: targetRepsMin,
      reason: `You completed ${targetRepsMax} reps across all sets. You can try increasing the weight by ${increment} kg.`,
      confidence: 'high',
    };
  }

  // Within range -> add reps
  if (minReps >= targetRepsMin) {
    return {
      action: 'add_reps',
      weightKg: topWeight,
      reps: Math.min(Math.ceil(avgReps) + 1, targetRepsMax),
      reason: `Try to increase the rep count at the same weight. Target: ${targetRepsMax} reps per set.`,
      confidence: 'high',
    };
  }

  // Below lower bound -> hold
  return {
    action: 'hold',
    weightKg: topWeight,
    reps: targetRepsMin,
    reason: `You haven't reached ${targetRepsMin} reps yet. Focus on staying at the same weight and raising your rep count.`,
    confidence: 'high',
  };
}

/** Weight suggestion for a specific target rep count (based on 1RM) */
export function suggestWeightForTargetReps(
  sets: SetLog[],
  targetReps: number,
): number {
  const working = sets.filter((s) => !s.is_warmup);
  if (working.length === 0) return 0;

  const best = Math.max(...working.map((s) => estimateOneRepMax(s.weight_kg, s.reps)));
  return roundToPlate(weightForReps(best, targetReps));
}