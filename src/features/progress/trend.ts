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

/** Setleri seansa gore gruplayip her seansin ozetini cikar. */
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

/** Son N seansin trendini yorumla. */
export function analyzeTrend(sets: SetLog[], windowSize = 6): Trend {
  const all = buildTrend(sets);
  const points = all.slice(-windowSize);

  if (points.length < 3) {
    return {
      points,
      direction: 'insufficient',
      changePercent: 0,
      summary: 'Trend icin en az 3 antrenman kaydi gerekiyor.',
    };
  }

  const first = points[0].oneRepMax;
  const last = points[points.length - 1].oneRepMax;
  const changePercent = first > 0 ? ((last - first) / first) * 100 : 0;

  let direction: Trend['direction'] = 'flat';
  if (changePercent > 2) direction = 'up';
  else if (changePercent < -2) direction = 'down';

  const weeks = weeksBetween(points[0].date, points[points.length - 1].date);
  const period = weeks >= 1 ? `${Math.round(weeks)} haftada` : 'son antrenmanlarda';

  const summary =
    direction === 'up'
      ? `${period} tahmini gucun %${Math.abs(changePercent).toFixed(1)} artmis.`
      : direction === 'down'
        ? `${period} tahmini gucun %${Math.abs(changePercent).toFixed(1)} dusmus. Dinlenme ve beslenmeyi gozden gecirmek faydali olabilir.`
        : `${period} performansin sabit seyrediyor.`;

  return { points, direction, changePercent, summary };
}

function weeksBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms / (1000 * 60 * 60 * 24 * 7);
}

/** Kac hafta sonra hedef agirliga ulasilir? Mevcut hiza gore kaba tahmin. */
export function estimateWeeksToTarget(
  sets: SetLog[],
  targetWeightKg: number,
): { weeks: number | null; note: string } {
  const points = buildTrend(sets);
  if (points.length < 4) {
    return {
      weeks: null,
      note: 'Tahmin icin en az 4 antrenman kaydi gerekiyor.',
    };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const weeksElapsed = weeksBetween(first.date, last.date);

  if (weeksElapsed < 1) {
    return { weeks: null, note: 'Tahmin icin daha uzun bir gecmis gerekiyor.' };
  }

  const gain = last.topWeight - first.topWeight;
  const perWeek = gain / weeksElapsed;

  if (perWeek <= 0) {
    return {
      weeks: null,
      note: 'Mevcut verilerle ilerleme hizi hesaplanamiyor.',
    };
  }

  const remaining = targetWeightKg - last.topWeight;
  if (remaining <= 0) {
    return { weeks: 0, note: 'Bu agirliga zaten ulastin.' };
  }

  const weeks = Math.ceil(remaining / perWeek);

  return {
    weeks,
    note:
      'Bu tahmin gecmis hizina dayanir. Ilerleme dogrusal degildir; uyku, beslenme ve stres sonucu degistirir.',
  };
}
