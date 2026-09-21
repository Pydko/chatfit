import { describe, expect, it } from '@jest/globals';

import type { BodyMetric } from '@/types/body';
import {
  bmiCategory,
  bodyComposition,
  calculateBmi,
  calculateFfmi,
  dayNumber,
  weeklyWeightRate,
  weightTrend,
} from './calculations';

function makeMetric(date: string, weight: number | null, bodyFat: number | null = null): BodyMetric {
  return {
    id: `m-${date}`,
    user_id: 'u1',
    measured_on: date,
    weight_kg: weight,
    body_fat_pct: bodyFat,
    created_at: new Date().toISOString(),
  };
}

// One measurement per day starting from 2026-09-01
function makeDailySeries(startWeight: number, perDay: number, days: number): BodyMetric[] {
  const start = Date.UTC(2026, 8, 1);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(start + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return makeMetric(date, startWeight + perDay * i);
  });
}

describe('dayNumber', () => {
  it('difference between consecutive days is 1', () => {
    expect(dayNumber('2026-09-02') - dayNumber('2026-09-01')).toBe(1);
  });

  it('works correctly across month transitions', () => {
    expect(dayNumber('2026-10-01') - dayNumber('2026-09-30')).toBe(1);
  });
});

describe('calculateBmi', () => {
  it('returns 24.7 for 80 kg and 180 cm', () => {
    expect(calculateBmi(80, 180)).toBe(24.7);
  });

  it('returns null for invalid inputs', () => {
    expect(calculateBmi(0, 180)).toBeNull();
    expect(calculateBmi(80, 0)).toBeNull();
  });
});

describe('bmiCategory', () => {
  it('classifies boundary values correctly', () => {
    expect(bmiCategory(18.4)).toBe('underweight');
    expect(bmiCategory(18.5)).toBe('normal');
    expect(bmiCategory(24.9)).toBe('normal');
    expect(bmiCategory(25)).toBe('overweight');
    expect(bmiCategory(30)).toBe('obese');
  });
});

describe('bodyComposition', () => {
  it('80 kg, 20% fat -> 64 kg lean, 16 kg fat', () => {
    expect(bodyComposition(80, 20)).toEqual({ leanMassKg: 64, fatMassKg: 16 });
  });

  it('returns null for invalid body fat percentages', () => {
    expect(bodyComposition(80, 100)).toBeNull();
    expect(bodyComposition(80, -1)).toBeNull();
    expect(bodyComposition(0, 20)).toBeNull();
  });
});

describe('calculateFfmi', () => {
  it('normalized value equals raw value at 180 cm height', () => {
    const result = calculateFfmi(64, 180);
    expect(result).toEqual({ ffmi: 19.8, normalized: 19.8 });
  });

  it('normalized value is adjusted upwards at 170 cm height', () => {
    const result = calculateFfmi(60, 170);
    expect(result?.ffmi).toBe(20.8);
    expect(result?.normalized).toBe(21.4);
  });

  it('returns null for invalid inputs', () => {
    expect(calculateFfmi(0, 180)).toBeNull();
  });
});

describe('weightTrend', () => {
  it('trend equals weight itself on the first measurement', () => {
    const points = weightTrend([makeMetric('2026-09-01', 80)]);
    expect(points).toHaveLength(1);
    expect(points[0].trendKg).toBe(80);
  });

  it('approaches by 10% on consecutive days', () => {
    const points = weightTrend([makeMetric('2026-09-01', 80), makeMetric('2026-09-02', 81)]);
    expect(points[1].trendKg).toBe(80.1);
  });

  it('alpha grows based on number of days in gapped measurements', () => {
    const points = weightTrend([makeMetric('2026-09-01', 80), makeMetric('2026-09-04', 81)]);
    // 1 - 0.9^3 = 0.271
    expect(points[1].trendKg).toBe(80.27);
  });

  it('sorts unsorted input by date', () => {
    const points = weightTrend([makeMetric('2026-09-02', 81), makeMetric('2026-09-01', 80)]);
    expect(points.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-02']);
  });

  it('skips measurements without weight', () => {
    const points = weightTrend([
      makeMetric('2026-09-01', 80),
      makeMetric('2026-09-02', null, 18),
      makeMetric('2026-09-03', 80),
    ]);
    expect(points).toHaveLength(2);
  });
});

describe('weeklyWeightRate', () => {
  it('0.1 kg drop per day -> roughly -0.7 kg per week', () => {
    const rate = weeklyWeightRate(makeDailySeries(80, -0.1, 15));
    expect(rate).not.toBeNull();
    expect(rate!.kgPerWeek).toBeCloseTo(-0.7, 2);
    expect(rate!.entries).toBe(15);
    expect(rate!.daysCovered).toBe(14);
    expect(rate!.confidence).toBe('medium');
  });

  it('high confidence for sufficiently long series', () => {
    const rate = weeklyWeightRate(makeDailySeries(80, 0.05, 25));
    expect(rate!.kgPerWeek).toBeCloseTo(0.35, 2);
    expect(rate!.confidence).toBe('high');
  });

  it('returns null for fewer than 4 entries', () => {
    expect(weeklyWeightRate(makeDailySeries(80, -0.1, 3))).toBeNull();
  });

  it('returns null for intervals shorter than 7 days', () => {
    expect(weeklyWeightRate(makeDailySeries(80, -0.1, 5))).toBeNull();
  });

  it('ignores measurements older than 28 days', () => {
    const metrics = [makeMetric('2026-06-01', 100), ...makeDailySeries(80, 0, 15)];
    const rate = weeklyWeightRate(metrics);
    expect(rate!.kgPerWeek).toBe(0);
    expect(rate!.entries).toBe(15);
  });
});