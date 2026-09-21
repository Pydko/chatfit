import { describe, expect, it } from '@jest/globals';

import type { BodyMetric } from '@/types/body';
import { buildBodySummary } from './summary';

const TODAY = '2026-09-11';

function makeMetric(date: string, weight: number | null, bodyFat: number | null = null): BodyMetric {
  return {
    id: `m-${date}`,
    user_id: 'u1',
    measured_on: date,
    weight_kg: weight,
    body_fat_pct: bodyFat,
    created_at: '2026-09-01T00:00:00.000Z',
  };
}

// Daily series counting backwards from TODAY
function makeDailySeries(startWeight: number, perDay: number, days: number): BodyMetric[] {
  const end = Date.UTC(2026, 8, 11);
  return Array.from({ length: days }, (_, i) => {
    const offset = days - 1 - i;
    const date = new Date(end - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return makeMetric(date, startWeight - perDay * offset);
  });
}

describe('buildBodySummary', () => {
  it('returns null if there are no measurements', () => {
    expect(buildBodySummary([], 180, TODAY)).toBeNull();
    expect(buildBodySummary([makeMetric('2026-09-10', null, 20)], 180, TODAY)).toBeNull();
  });

  it('does not include too old measurements in context', () => {
    expect(buildBodySummary([makeMetric('2026-01-01', 80)], 180, TODAY)).toBeNull();
  });

  it('populates core fields on a single measurement', () => {
    const summary = buildBodySummary([makeMetric('2026-09-09', 80)], 180, TODAY);
    expect(summary).toMatchObject({
      weightKg: 80,
      trendKg: 80,
      daysSinceLast: 2,
      heightCm: 180,
      bmi: 24.7,
    });
  });

  it('leaves weekly rate fields empty on insufficient data', () => {
    const summary = buildBodySummary([makeMetric('2026-09-10', 80)], 180, TODAY);
    expect(summary?.kgPerWeek).toBeUndefined();
    expect(summary?.rateConfidence).toBeUndefined();
  });

  it('adds weekly rate on sufficient data', () => {
    const summary = buildBodySummary(makeDailySeries(80, 0.1, 15), 180, TODAY);
    expect(summary?.kgPerWeek).toBeCloseTo(0.7, 2);
    expect(summary?.rateConfidence).toBe('medium');
    expect(summary?.rateEntries).toBe(15);
  });

  it('does not calculate BMI and FFMI if height is missing', () => {
    const summary = buildBodySummary([makeMetric('2026-09-10', 80, 20)], null, TODAY);
    expect(summary?.bmi).toBeUndefined();
    expect(summary?.ffmi).toBeUndefined();
    expect(summary?.leanMassKg).toBe(64);
  });

  it('adds composition and FFMI if body fat percentage is present', () => {
    const summary = buildBodySummary([makeMetric('2026-09-10', 80, 20)], 180, TODAY);
    expect(summary?.bodyFatPct).toBe(20);
    expect(summary?.bodyFatDaysAgo).toBe(1);
    expect(summary?.leanMassKg).toBe(64);
    expect(summary?.ffmi).toBe(19.8);
  });

  it('uses the latest body fat measurement for composition', () => {
    const summary = buildBodySummary(
      [makeMetric('2026-09-01', 82, 22), makeMetric('2026-09-09', 80, 18), makeMetric('2026-09-10', 80)],
      180,
      TODAY,
    );
    expect(summary?.bodyFatPct).toBe(18);
    expect(summary?.bodyFatDaysAgo).toBe(2);
  });

  it('ignores old body fat measurements but returns the weight', () => {
    const summary = buildBodySummary(
      [makeMetric('2026-01-01', 82, 22), makeMetric('2026-09-10', 80)],
      180,
      TODAY,
    );
    expect(summary?.weightKg).toBe(80);
    expect(summary?.bodyFatPct).toBeUndefined();
  });
});