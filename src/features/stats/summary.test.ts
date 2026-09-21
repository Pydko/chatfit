import {
  buildWeeklyStats,
  computeWeekStreak,
  formatVolume,
  summarizeSessions,
  totalsBetween,
  type StatSession,
  type StatSet,
} from './summary';

const NOW = new Date('2026-09-14T12:00:00.000Z');
const DAY = 86_400_000;

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * DAY).toISOString();
}

function makeSet(
  sessionId: string,
  weight: number,
  reps: number,
  opts: { warmup?: boolean; exerciseId?: string; days?: number } = {},
): StatSet {
  return {
    session_id: sessionId,
    exercise_id: opts.exerciseId ?? 'ex1',
    weight_kg: weight,
    reps,
    is_warmup: opts.warmup ?? false,
    performed_at: daysAgo(opts.days ?? 0),
  };
}

function makeSession(id: string, days: number): StatSession {
  return { id, performed_at: daysAgo(days) };
}

describe('summarizeSessions', () => {
  it('calculates set count, volume, and exercise count per session', () => {
    const sets = [
      makeSet('s1', 100, 5),
      makeSet('s1', 100, 5),
      makeSet('s1', 60, 10, { exerciseId: 'ex2' }),
      makeSet('s2', 80, 8),
    ];

    const stats = summarizeSessions(sets);

    expect(stats.get('s1')?.setCount).toBe(3);
    expect(stats.get('s1')?.volumeKg).toBe(1600);
    expect(stats.get('s1')?.exerciseCount).toBe(2);
    expect(stats.get('s2')?.setCount).toBe(1);
  });

  it('excludes warmup sets', () => {
    const sets = [
      makeSet('s1', 20, 10, { warmup: true }),
      makeSet('s1', 100, 5),
    ];

    const stats = summarizeSessions(sets);

    expect(stats.get('s1')?.setCount).toBe(1);
    expect(stats.get('s1')?.volumeKg).toBe(500);
  });

  it('session is not included in map if there are only warmup sets', () => {
    const stats = summarizeSessions([makeSet('s1', 20, 10, { warmup: true })]);
    expect(stats.has('s1')).toBe(false);
  });

  it('returns empty map for empty input', () => {
    expect(summarizeSessions([]).size).toBe(0);
  });
});

describe('totalsBetween', () => {
  it('counts only sessions within the range', () => {
    const sessions = [makeSession('s1', 2), makeSession('s2', 10)];
    const sets = [makeSet('s1', 100, 5), makeSet('s2', 100, 5)];

    const totals = totalsBetween(
      sets,
      sessions,
      NOW.getTime() - 7 * DAY,
      NOW.getTime() + 1,
    );

    expect(totals.sessions).toBe(1);
    expect(totals.sets).toBe(1);
    expect(totals.volumeKg).toBe(500);
  });

  it('returns zero if there are no sessions in range', () => {
    const totals = totalsBetween(
      [makeSet('s1', 100, 5)],
      [makeSession('s1', 30)],
      NOW.getTime() - 7 * DAY,
      NOW.getTime() + 1,
    );

    expect(totals).toEqual({ sessions: 0, sets: 0, volumeKg: 0 });
  });
});

describe('computeWeekStreak', () => {
  it('returns 0 if there are no records', () => {
    expect(computeWeekStreak([], NOW)).toBe(0);
  });

  it('counts consecutive weeks', () => {
    const sessions = [makeSession('a', 1), makeSession('b', 9), makeSession('c', 16)];
    expect(computeWeekStreak(sessions, NOW)).toBe(3);
  });

  it('broken week breaks the streak', () => {
    const sessions = [makeSession('a', 1), makeSession('b', 20)];
    expect(computeWeekStreak(sessions, NOW)).toBe(1);
  });

  it('does not break streak if there are no workouts yet this week', () => {
    const sessions = [makeSession('a', 9), makeSession('b', 16)];
    expect(computeWeekStreak(sessions, NOW)).toBe(2);
  });
});

describe('buildWeeklyStats', () => {
  it('compares the current week with the previous week', () => {
    const sessions = [makeSession('s1', 2), makeSession('s2', 10)];
    const sets = [
      makeSet('s1', 100, 5), // 500
      makeSet('s1', 100, 5), // 500
      makeSet('s2', 100, 5), // 500 (previous week)
    ];

    const stats = buildWeeklyStats(sets, sessions, NOW);

    expect(stats.current.volumeKg).toBe(1000);
    expect(stats.previous.volumeKg).toBe(500);
    expect(stats.volumeChangePct).toBe(100);
  });

  it('returns null change if there is no data for the previous week', () => {
    const stats = buildWeeklyStats(
      [makeSet('s1', 100, 5)],
      [makeSession('s1', 1)],
      NOW,
    );

    expect(stats.volumeChangePct).toBeNull();
  });

  it('returns safe defaults if there is no data at all', () => {
    const stats = buildWeeklyStats([], [], NOW);

    expect(stats.current).toEqual({ sessions: 0, sets: 0, volumeKg: 0 });
    expect(stats.weekStreak).toBe(0);
  });
});

describe('formatVolume', () => {
  it('displays volume under 1000 kg as kg', () => {
    expect(formatVolume(850)).toBe('850 kg');
  });

  it('displays volume over 1000 kg as tons', () => {
    expect(formatVolume(12450)).toBe('12.5 tons');
  });
});