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
  it('seans basina set, hacim ve hareket sayisini hesaplar', () => {
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

  it('isinma setlerini haric tutar', () => {
    const sets = [
      makeSet('s1', 20, 10, { warmup: true }),
      makeSet('s1', 100, 5),
    ];

    const stats = summarizeSessions(sets);

    expect(stats.get('s1')?.setCount).toBe(1);
    expect(stats.get('s1')?.volumeKg).toBe(500);
  });

  it('sadece isinma varsa seans haritada yer almaz', () => {
    const stats = summarizeSessions([makeSet('s1', 20, 10, { warmup: true })]);
    expect(stats.has('s1')).toBe(false);
  });

  it('bos girdi icin bos harita doner', () => {
    expect(summarizeSessions([]).size).toBe(0);
  });
});

describe('totalsBetween', () => {
  it('sadece aralik icindeki seanslari sayar', () => {
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

  it('aralikta seans yoksa sifir doner', () => {
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
  it('kayit yoksa 0 doner', () => {
    expect(computeWeekStreak([], NOW)).toBe(0);
  });

  it('ust uste haftalari sayar', () => {
    const sessions = [makeSession('a', 1), makeSession('b', 9), makeSession('c', 16)];
    expect(computeWeekStreak(sessions, NOW)).toBe(3);
  });

  it('bos hafta seriyi keser', () => {
    const sessions = [makeSession('a', 1), makeSession('b', 20)];
    expect(computeWeekStreak(sessions, NOW)).toBe(1);
  });

  it('bu hafta henuz antrenman yoksa seriyi bozmaz', () => {
    const sessions = [makeSession('a', 9), makeSession('b', 16)];
    expect(computeWeekStreak(sessions, NOW)).toBe(2);
  });
});

describe('buildWeeklyStats', () => {
  it('son hafta ile onceki haftayi karsilastirir', () => {
    const sessions = [makeSession('s1', 2), makeSession('s2', 10)];
    const sets = [
      makeSet('s1', 100, 5), // 500
      makeSet('s1', 100, 5), // 500
      makeSet('s2', 100, 5), // 500 (onceki hafta)
    ];

    const stats = buildWeeklyStats(sets, sessions, NOW);

    expect(stats.current.volumeKg).toBe(1000);
    expect(stats.previous.volumeKg).toBe(500);
    expect(stats.volumeChangePct).toBe(100);
  });

  it('onceki hafta veri yoksa degisim null olur', () => {
    const stats = buildWeeklyStats(
      [makeSet('s1', 100, 5)],
      [makeSession('s1', 1)],
      NOW,
    );

    expect(stats.volumeChangePct).toBeNull();
  });

  it('hic veri yoksa guvenli varsayilan doner', () => {
    const stats = buildWeeklyStats([], [], NOW);

    expect(stats.current).toEqual({ sessions: 0, sets: 0, volumeKg: 0 });
    expect(stats.weekStreak).toBe(0);
  });
});

describe('formatVolume', () => {
  it('1000 kg altini kg olarak gosterir', () => {
    expect(formatVolume(850)).toBe('850 kg');
  });

  it('1000 kg ustunu ton olarak gosterir', () => {
    expect(formatVolume(12450)).toBe('12.5 ton');
  });
});