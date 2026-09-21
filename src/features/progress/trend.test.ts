import type { SetLog } from '@/types/workout';
import { describe, expect, it } from '@jest/globals';
import {
  analyzeTrend,
  buildTrend,
  estimateWeeksToTarget,
} from './trend';

function makeSet(
  weight: number,
  reps: number,
  sessionId: string,
  daysAgo = 0,
  isWarmup = false,
): SetLog {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  
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
    performed_at: date.toISOString(),
  };
}

describe('buildTrend', () => {
  it("groups by session and summarizes each session", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 0),
      makeSet(80, 5, 'sess1', 0),
      makeSet(70, 8, 'sess2', 7),
    ];
    const points = buildTrend(sets);

    expect(points.length).toBe(2);
    expect(points[0].topWeight).toBe(70); 
    expect(points[1].topWeight).toBe(80);
  });

  it("excludes warmup sets", () => {
    const sets = [
      makeSet(20, 10, 'sess1', 0, true), // warmup set
      makeSet(80, 5, 'sess1', 0),
    ];
    const points = buildTrend(sets);

    expect(points.length).toBe(1);
    expect(points[0].topWeight).toBe(80);
  });

  it("sorts by date order", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 0),  // Newest
      makeSet(70, 8, 'sess2', 14), // Oldest
      makeSet(75, 6, 'sess3', 7),  // Middle
    ];
    const points = buildTrend(sets);

    expect(points.length).toBe(3);
    expect(points[0].topWeight).toBe(70); // 14 days ago
    expect(points[1].topWeight).toBe(75); // 7 days ago
    expect(points[2].topWeight).toBe(80); // Today
  });
});

describe('analyzeTrend', () => {
  it("returns insufficient for under 3 workouts", () => {
    const sets = [makeSet(80, 5, 'sess1', 0)];
    const trend = analyzeTrend(sets);

    expect(trend.direction).toBe('insufficient');
    expect(trend.summary).toContain('3');
  });

  it("detects an upward trend", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 28),
      makeSet(85, 5, 'sess2', 21),
      makeSet(90, 5, 'sess3', 14),
      makeSet(95, 5, 'sess4', 7),
    ];
    const trend = analyzeTrend(sets);

    expect(trend.direction).toBe('up');
    expect(trend.changePercent).toBeGreaterThan(0);
    expect(trend.summary).toContain('increased');
  });

  it("detects a downward trend", () => {
    const sets = [
      makeSet(100, 5, 'sess1', 28),
      makeSet(95, 5, 'sess2', 21),
      makeSet(90, 5, 'sess3', 14),
      makeSet(85, 5, 'sess4', 7),
    ];
    const trend = analyzeTrend(sets);

    expect(trend.direction).toBe('down');
    expect(trend.changePercent).toBeLessThan(0);
    expect(trend.summary).toContain('decreased');
  });

  it("flat trend (2% tolerance)", () => {
    const sets = [
      makeSet(90, 5, 'sess1', 14),
      makeSet(90.5, 5, 'sess2', 7),
      makeSet(89.8, 5, 'sess3', 0),
    ];
    const trend = analyzeTrend(sets);

    expect(trend.direction).toBe('flat');
  });

  it("looks at the last 6 sessions (default window)", () => {
    const sets = [
      makeSet(70, 5, 'sess1', 49),
      makeSet(75, 5, 'sess2', 42),
      makeSet(80, 5, 'sess3', 35),
      makeSet(85, 5, 'sess4', 28),
      makeSet(90, 5, 'sess5', 21),
      makeSet(95, 5, 'sess6', 14),
      makeSet(100, 5, 'sess7', 7), // Total 7 workouts
    ];

    const trend = analyzeTrend(sets);
    expect(trend.points.length).toBeLessThanOrEqual(6); 
  });
});

describe('estimateWeeksToTarget', () => {
  it("cannot estimate under 4 workouts", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 14),
      makeSet(85, 5, 'sess2', 7),
      makeSet(90, 5, 'sess3', 0),
    ];
    const result = estimateWeeksToTarget(sets, 110);

    expect(result.weeks).toBeNull();
    expect(result.note).toContain('4');
  });

  it("returns weeks = 0 if target is already reached", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 28),
      makeSet(85, 5, 'sess2', 21),
      makeSet(90, 5, 'sess3', 14),
      makeSet(110, 5, 'sess4', 7),
    ];
    const result = estimateWeeksToTarget(sets, 100); // Target 100, reached 110

    expect(result.weeks).toBe(0);
  });

  it("estimates weeks based on progression rate", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 28),
      makeSet(85, 5, 'sess2', 21),
      makeSet(90, 5, 'sess3', 14),
      makeSet(100, 5, 'sess4', 7),
    ];
    const result = estimateWeeksToTarget(sets, 120);

    expect(result.weeks).toBeLessThanOrEqual(5);
    expect(result.weeks).toBeGreaterThanOrEqual(3);
  });

  it("returns null if there is regressing progress", () => {
    const sets = [
      makeSet(100, 5, 'sess1', 21),
      makeSet(95, 5, 'sess2', 14),
      makeSet(90, 5, 'sess3', 7),
      makeSet(80, 5, 'sess4', 0), // Weight consistently dropping
    ];
    const result = estimateWeeksToTarget(sets, 150);

    expect(result.weeks).toBeNull();
    expect(result.note).toContain('rate cannot be calculated');
  });

  it("cannot estimate for data spanning less than 1 week", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 0),
      makeSet(85, 5, 'sess2', 0),
      makeSet(90, 5, 'sess3', 0),
      makeSet(100, 5, 'sess4', 0),
    ];
    const result = estimateWeeksToTarget(sets, 120);

    expect(result.weeks).toBeNull();
  });
});