import { describe, expect, it } from '@jest/globals';

import type { SetLog } from '@/types/workout';
import {
  suggestProgression,
  suggestWeightForTargetReps,
} from './progression';

function makeSet(
  weight: number,
  reps: number,
  isWarmup = false,
  sessionId = 'sess1',
): SetLog {
  return {
    id: `s-${weight}-${reps}-${Math.random()}`,
    user_id: 'u1',
    session_id: sessionId,
    exercise_id: 'ex1',
    set_index: 1,
    weight_kg: weight,
    reps,
    rpe: null,
    is_warmup: isWarmup,
    performed_at: new Date().toISOString(),
  };
}

describe('suggestProgression - Double Progression', () => {
  it('returns no_data if there is no data', () => {
    const result = suggestProgression({
      lastSessionSets: [],
      previousSessions: [],
    });

    expect(result.action).toBe('no_data');
    expect(result.confidence).toBe('low');
  });

  it('all sets above target range (minReps >= targetRepsMax)', () => {
    const lastSession = [
      makeSet(80, 13),
      makeSet(80, 12),
    ];

    const result = suggestProgression({
      lastSessionSets: lastSession,
      previousSessions: [],
      targetRepsMin: 8,
      targetRepsMax: 12,
      increment: 2.5,
    });

    expect(result.action).toBe('increase_weight');
    expect(result.weightKg).toBe(82.5);
    expect(result.reps).toBe(8);
    expect(result.confidence).toBe('high');
  });

  it('within range -> suggest add_reps', () => {
    const lastSession = [
      makeSet(80, 9),
      makeSet(80, 10),
    ];

    const result = suggestProgression({
      lastSessionSets: lastSession,
      previousSessions: [],
      targetRepsMin: 8,
      targetRepsMax: 12,
    });

    expect(result.action).toBe('add_reps');
    expect(result.weightKg).toBe(80);

    expect(result.reps).toBeDefined();
    expect(result.reps!).toBeGreaterThan(9);
    expect(result.reps!).toBeLessThanOrEqual(12);

    expect(result.confidence).toBe('high');
  });

  it('below lower bound -> suggest hold', () => {
    const lastSession = [
      makeSet(80, 5),
      makeSet(80, 6),
    ];

    const result = suggestProgression({
      lastSessionSets: lastSession,
      previousSessions: [],
      targetRepsMin: 8,
      targetRepsMax: 12,
    });

    expect(result.action).toBe('hold');
    expect(result.weightKg).toBe(80);
    expect(result.confidence).toBe('high');
  });

  it('deload: performance dropped in the last 3 sessions', () => {
    const lastSession = [
      makeSet(75, 5),
    ];

    const previousSessions = [
      [makeSet(85, 5)],
      [makeSet(95, 5)],
    ];

    const result = suggestProgression({
      lastSessionSets: lastSession,
      previousSessions,
      targetRepsMin: 8,
      targetRepsMax: 12,
      increment: 2.5,
    });

    expect(result.action).toBe('deload');

    expect(result.weightKg).toBeDefined();
    expect(result.weightKg!).toBeLessThan(75);

    expect(result.reason || '').toContain('dropped');

    expect(result.confidence).toBe('medium');
  });

  it('excludes warmup sets', () => {
    const lastSession = [
      makeSet(20, 10, true),
      makeSet(80, 8),
      makeSet(80, 9),
    ];

    const result = suggestProgression({
      lastSessionSets: lastSession,
      previousSessions: [],
      targetRepsMin: 8,
      targetRepsMax: 12,
    });

    expect(result.action).toBe('add_reps');
    expect(result.weightKg).toBe(80);
  });

  it('uses custom increment', () => {
    const lastSession = [
      makeSet(30, 13),
      makeSet(30, 12),
    ];

    const result = suggestProgression({
      lastSessionSets: lastSession,
      previousSessions: [],
      targetRepsMin: 8,
      targetRepsMax: 12,
      increment: 2,
    });

    expect(result.action).toBe('increase_weight');
    expect(result.weightKg).toBe(32);
  });
});

describe('suggestWeightForTargetReps', () => {
  it('suggests weight for target reps', () => {
    const sets = [
      makeSet(80, 5),
    ];

    const suggestion = suggestWeightForTargetReps(sets, 10);

    expect(suggestion).toBeGreaterThan(65);
    expect(suggestion).toBeLessThan(75);
  });

  it('returns 0 if there are no working sets', () => {
    const sets = [
      makeSet(20, 10, true),
    ];

    const suggestion = suggestWeightForTargetReps(sets, 8);

    expect(suggestion).toBe(0);
  });

  it('bases suggestion on the highest 1RM', () => {
    const sets = [
      makeSet(80, 5),
      makeSet(60, 10),
    ];

    const suggestion = suggestWeightForTargetReps(sets, 8);

    expect(suggestion).toBeGreaterThan(70);
    expect(suggestion).toBeLessThan(78);
  });
});