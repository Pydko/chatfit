import type { SetLog } from '@/types/workout';
import { estimateOneRepMax, totalTonnage } from './formulas';

export type TrendPoint = {
  date: string;
  oneRepMax: number;
  tonnage: number;
  topWeight: number;
  totalReps: number;
};

export type Trend = {
  points: TrendPoint[];
  direction: 'up' | 'down' | 'flat' | 'insufficient';
  changePercent: number;
  summary: string;
};

/** Group sets by session and summarize each session. */
export function buildTrend(sets: SetLog[]): TrendPoint[] {
  const bySession = new Map<string, SetLog[]>();
  for (const set of sets) {
    if (set.is_warmup) continue;
    const list = bySession.get(set.session_id) ?? [];
    list.push(set);
    bySession.set(set.session_id, list);
  }

  const points: TrendPoint[] = [];
  for (const [, sessionSets] of bySession) {
    if (sessionSets.length === 0) continue;
    points.push({
      date: sessionSets[0].performed_at,
      oneRepMax: Math.max(
        ...sessionSets.map((s) => estimateOneRepMax(s.weight_kg, s.reps)),
      ),
      tonnage: totalTonnage(sessionSets),
      topWeight: Math.max(...sessionSets.map((s) => s.weight_kg)),
      totalReps: sessionSets.reduce((sum, s) => sum + s.reps, 0),
    });
  }

  return points.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

/** Interpret the trend of the last N sessions. */
export function analyzeTrend(sets: SetLog[], windowSize = 6): Trend {
  const all = buildTrend(sets);
  const points = all.slice(-windowSize);

  if (points.length < 3) {
    return {
      points,
      direction: 'insufficient',
      changePercent: 0,
      summary: 'At least 3 workout logs are required for trend analysis.',
    };
  }

  const first = points[0].oneRepMax;
  const last = points[points.length - 1].oneRepMax;
  const changePercent = first > 0 ? ((last - first) / first) * 100 : 0;

  let direction: Trend['direction'] = 'flat';
  if (changePercent > 2) direction = 'up';
  else if (changePercent < -2) direction = 'down';

  const weeks = weeksBetween(points[0].date, points[points.length - 1].date);
  const period = weeks >= 1 ? `over ${Math.round(weeks)} week(s)` : 'in recent workouts';

  const summary =
    direction === 'up'
      ? `Estimated strength has increased by ${Math.abs(changePercent).toFixed(1)}% ${period}.`
      : direction === 'down'
        ? `Estimated strength has decreased by ${Math.abs(changePercent).toFixed(1)}% ${period}. Reviewing sleep and nutrition may be helpful.`
        : `Performance has remained stable ${period}.`;

  return { points, direction, changePercent, summary };
}

function weeksBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms / (1000 * 60 * 60 * 24 * 7);
}

/** In how many weeks will the target weight be reached? Rough estimation based on current velocity. */
export function estimateWeeksToTarget(
  sets: SetLog[],
  targetWeightKg: number,
): { weeks: number | null; note: string } {
  const points = buildTrend(sets);
  if (points.length < 4) {
    return {
      weeks: null,
      note: 'At least 4 workout logs are required for estimation.',
    };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const weeksElapsed = weeksBetween(first.date, last.date);

  if (weeksElapsed < 1) {
    return { weeks: null, note: 'A longer history is required for estimation.' };
  }

  const gain = last.topWeight - first.topWeight;
  const perWeek = gain / weeksElapsed;

  if (perWeek <= 0) {
    return {
      weeks: null,
      note: 'Progression rate cannot be calculated with current data.',
    };
  }

  const remaining = targetWeightKg - last.topWeight;
  if (remaining <= 0) {
    return { weeks: 0, note: 'You have already reached this weight.' };
  }

  const weeks = Math.ceil(remaining / perWeek);

  return {
    weeks,
    note:
      'This estimate is based on past velocity. Progression is not linear; sleep, nutrition, and stress can alter results.',
  };
}