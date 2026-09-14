// Saf hesaplama katmani: hicbir yerden veri cekmez, sadece veriyi ozetler.

export type StatSet = {
  session_id: string;
  exercise_id: string;
  weight_kg: number;
  reps: number;
  is_warmup: boolean;
  performed_at: string;
};

export type StatSession = {
  id: string;
  performed_at: string;
};

export type SessionStat = {
  sessionId: string;
  setCount: number;
  volumeKg: number;
  exerciseCount: number;
};

export type PeriodTotals = {
  sessions: number;
  sets: number;
  volumeKg: number;
};

export type WeeklyStats = {
  current: PeriodTotals;
  previous: PeriodTotals;
  volumeChangePct: number | null;
  weekStreak: number;
};

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MAX_STREAK_WEEKS = 104;

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseTime(iso: string): number {
  return Date.parse(iso);
}

/** Seans basina set sayisi, hacim ve hareket sayisi. Isinma setleri sayilmaz. */
export function summarizeSessions(sets: StatSet[]): Map<string, SessionStat> {
  const acc = new Map<string, { setCount: number; volumeKg: number; exercises: Set<string> }>();

  for (const set of sets) {
    if (set.is_warmup) continue;

    let entry = acc.get(set.session_id);
    if (!entry) {
      entry = { setCount: 0, volumeKg: 0, exercises: new Set<string>() };
      acc.set(set.session_id, entry);
    }

    entry.setCount += 1;
    entry.volumeKg += set.weight_kg * set.reps;
    entry.exercises.add(set.exercise_id);
  }

  const result = new Map<string, SessionStat>();
  for (const [sessionId, entry] of acc) {
    result.set(sessionId, {
      sessionId,
      setCount: entry.setCount,
      volumeKg: round(entry.volumeKg),
      exerciseCount: entry.exercises.size,
    });
  }
  return result;
}

/** [startMs, endMs) araligindaki seanslarin toplamlari. */
export function totalsBetween(
  sets: StatSet[],
  sessions: StatSession[],
  startMs: number,
  endMs: number,
): PeriodTotals {
  const ids = new Set<string>();
  for (const session of sessions) {
    const t = parseTime(session.performed_at);
    if (Number.isNaN(t)) continue;
    if (t >= startMs && t < endMs) ids.add(session.id);
  }

  let setCount = 0;
  let volume = 0;

  for (const set of sets) {
    if (set.is_warmup) continue;
    if (!ids.has(set.session_id)) continue;
    setCount += 1;
    volume += set.weight_kg * set.reps;
  }

  return { sessions: ids.size, sets: setCount, volumeKg: round(volume) };
}

/**
 * Ust uste antrenman yapilan 7 gunluk blok sayisi.
 * Icinde bulunulan blokta henuz antrenman yoksa seri bozulmaz (tolerans).
 */
export function computeWeekStreak(sessions: StatSession[], now: Date = new Date()): number {
  const times = sessions
    .map((s) => parseTime(s.performed_at))
    .filter((t) => !Number.isNaN(t));

  if (times.length === 0) return 0;

  const nowMs = now.getTime();
  let streak = 0;

  for (let i = 0; i < MAX_STREAK_WEEKS; i++) {
    const end = nowMs - i * WEEK_MS;
    const start = end - WEEK_MS;
    const hasWorkout = times.some((t) => t > start && t <= end);

    if (hasWorkout) {
      streak += 1;
    } else if (i === 0) {
      continue; // bu hafta henuz calismadiysa seriyi kirma
    } else {
      break;
    }
  }

  return streak;
}

/** Son 7 gun vs onceki 7 gun karsilastirmasi. */
export function buildWeeklyStats(
  sets: StatSet[],
  sessions: StatSession[],
  now: Date = new Date(),
): WeeklyStats {
  const nowMs = now.getTime();

  const current = totalsBetween(sets, sessions, nowMs - WEEK_MS, nowMs + 1);
  const previous = totalsBetween(sets, sessions, nowMs - 2 * WEEK_MS, nowMs - WEEK_MS);

  const volumeChangePct =
    previous.volumeKg > 0
      ? round(((current.volumeKg - previous.volumeKg) / previous.volumeKg) * 100, 1)
      : null;

  return {
    current,
    previous,
    volumeChangePct,
    weekStreak: computeWeekStreak(sessions, now),
  };
}

/** 12450 -> "12.5 ton", 850 -> "850 kg" */
export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${round(kg / 1000, 1)} ton`;
  return `${round(kg)} kg`;
}