import type { SetLog } from '@/types/workout';
import {
  bestSetOf,
  estimateOneRepMax,
  oneRepMaxConfidence,
  roundToPlate,
  totalTonnage,
  weightForReps,
} from './formulas';

function makeSet(weight: number, reps: number, isWarmup = false): SetLog {
  return {
    id: `s-${weight}-${reps}-${Math.random()}`,
    user_id: 'u1',
    session_id: 'sess1',
    exercise_id: 'ex1',
    set_index: 1,
    weight_kg: weight,
    reps,
    rpe: null,
    is_warmup: isWarmup,
    performed_at: new Date().toISOString(),
  };
}

describe('estimateOneRepMax', () => {
  it('tek tekrarda agirligin kendisini doner', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('tekrar arttikca tahmini 1RM artar', () => {
    const at5 = estimateOneRepMax(80, 5);
    const at8 = estimateOneRepMax(80, 8);
    expect(at8).toBeGreaterThan(at5);
    expect(at5).toBeGreaterThan(80);
  });

  it('bilinen deger araliginda kalir', () => {
    // 100kg x 5 -> literaturde ~112-117 kg araligi
    const result = estimateOneRepMax(100, 5);
    expect(result).toBeGreaterThan(110);
    expect(result).toBeLessThan(120);
  });

  it('gecersiz girdilerde sifir doner', () => {
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(100, 0)).toBe(0);
    expect(estimateOneRepMax(-50, 5)).toBe(0);
  });
});

describe('oneRepMaxConfidence', () => {
  it('dusuk tekrarda yuksek guven', () => {
    expect(oneRepMaxConfidence(3)).toBe('high');
    expect(oneRepMaxConfidence(5)).toBe('high');
  });

  it('yuksek tekrarda dusuk guven', () => {
    expect(oneRepMaxConfidence(15)).toBe('low');
  });
});

describe('weightForReps', () => {
  it('1RM ve estimateOneRepMax birbirinin tersi gibi davranir', () => {
    const oneRm = estimateOneRepMax(100, 5);
    const backToFive = weightForReps(oneRm, 5);
    expect(Math.abs(backToFive - 100)).toBeLessThan(2);
  });

  it('tekrar arttikca onerilen agirlik duser', () => {
    const at3 = weightForReps(120, 3);
    const at10 = weightForReps(120, 10);
    expect(at10).toBeLessThan(at3);
  });
});

describe('totalTonnage', () => {
  it('agirlik x tekrar toplamini hesaplar', () => {
    const sets = [makeSet(50, 10), makeSet(60, 8)];
    expect(totalTonnage(sets)).toBe(50 * 10 + 60 * 8);
  });

  it('isinma setlerini haric tutar', () => {
    const sets = [makeSet(50, 10), makeSet(20, 15, true)];
    expect(totalTonnage(sets)).toBe(500);
  });
});

describe('roundToPlate', () => {
  it('2.5 kg katlarina yuvarlar', () => {
    expect(roundToPlate(61.2)).toBe(60);
    expect(roundToPlate(63.8)).toBe(65);
  });

  it('ozel artis adimini kullanir', () => {
    expect(roundToPlate(21.4, 2)).toBe(22);
  });
});

describe('bestSetOf', () => {
  it('en yuksek tahmini 1RM veren seti secer', () => {
    // 100x3 -> ~108, 70x12 -> ~99. Agir set kazanir.
    const heavy = makeSet(100, 3);
    const volume = makeSet(70, 12);
    const best = bestSetOf([heavy, volume]);
    expect(best).toBeTruthy();
    expect(best?.weight_kg).toBe(100);
  });

  it('hacim seti yeterince yuksekse agir seti geceber', () => {
    // 60x20 -> ~100, 80x2 -> ~85. Hacim seti kazanir.
    const heavy = makeSet(80, 2);
    const volume = makeSet(60, 20);
    const best = bestSetOf([heavy, volume]);
    expect(best?.weight_kg).toBe(60);
  });

  it('sadece isinma varsa null doner', () => {
    expect(bestSetOf([makeSet(20, 10, true)])).toBeNull();
  });
});