import type { BodyMetric } from '@/types/body';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  const result = Math.round(value * factor) / factor;
  return result === 0 ? 0 : result; // -0 donmesin
}

// 'YYYY-MM-DD' -> UTC gun numarasi. Saat dilimi kaymasi olmasin diye UTC.
export function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

// ============ BMI ============

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

export const BMI_LABELS: Record<BmiCategory, string> = {
  underweight: 'Zayıf',
  normal: 'Normal',
  overweight: 'Fazla kilolu',
  obese: 'Obez',
};

export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (weightKg <= 0 || heightCm <= 0) return null;
  const h = heightCm / 100;
  return round(weightKg / (h * h), 1);
}

// DSO siniflandirmasi. Kaslı kisilerde yaniltici olabilir - UI'da not dusulmeli.
export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

// ============ VUCUT KOMPOZISYONU ============

export type Composition = {
  leanMassKg: number;
  fatMassKg: number;
};

export function bodyComposition(weightKg: number, bodyFatPct: number): Composition | null {
  if (weightKg <= 0 || bodyFatPct < 0 || bodyFatPct >= 100) return null;
  const fat = weightKg * (bodyFatPct / 100);
  return {
    leanMassKg: round(weightKg - fat, 1),
    fatMassKg: round(fat, 1),
  };
}

export type Ffmi = {
  ffmi: number;
  normalized: number; // 1.80 m boya gore duzeltilmis
};

// Yagsiz kutle indeksi. Normalize deger farkli boylari karsilastirilabilir yapar.
export function calculateFfmi(leanMassKg: number, heightCm: number): Ffmi | null {
  if (leanMassKg <= 0 || heightCm <= 0) return null;
  const h = heightCm / 100;
  const ffmi = leanMassKg / (h * h);
  return {
    ffmi: round(ffmi, 1),
    normalized: round(ffmi + 6.1 * (1.8 - h), 1),
  };
}

// ============ KILO TRENDI ============

export type WeightPoint = {
  date: string;
  weightKg: number;
  trendKg: number;
};

// Gunluk %10 agirlikli ussel hareketli ortalama.
// Olcumler arasinda bosluk varsa alfa gun sayisina gore buyur,
// boylece haftada bir tartilan kullanicida trend geride kalmaz.
const TREND_ALPHA_PER_DAY = 0.1;

export function weightTrend(
  metrics: BodyMetric[],
  alphaPerDay = TREND_ALPHA_PER_DAY,
): WeightPoint[] {
  const rows = metrics
    .filter((m): m is BodyMetric & { weight_kg: number } => m.weight_kg !== null && m.weight_kg > 0)
    .sort((a, b) => dayNumber(a.measured_on) - dayNumber(b.measured_on));

  const points: WeightPoint[] = [];
  let trend: number | null = null;
  let prevDay: number | null = null;

  for (const row of rows) {
    const day = dayNumber(row.measured_on);

    if (trend === null || prevDay === null) {
      trend = row.weight_kg;
    } else {
      const gap = Math.max(1, day - prevDay);
      const alpha = 1 - Math.pow(1 - alphaPerDay, gap);
      trend = trend + alpha * (row.weight_kg - trend);
    }

    prevDay = day;
    points.push({ date: row.measured_on, weightKg: row.weight_kg, trendKg: round(trend, 2) });
  }

  return points;
}

// ============ HAFTALIK DEGISIM HIZI ============

export type WeeklyRate = {
  kgPerWeek: number;
  daysCovered: number;
  entries: number;
  confidence: 'low' | 'medium' | 'high';
};

const RATE_WINDOW_DAYS = 28;
const MIN_ENTRIES = 4;
const MIN_SPAN_DAYS = 7;

// Son 28 gunun ham olcumlerine en kucuk kareler dogrusu.
// Yetersiz veri varsa null: tahmin uydurmak yerine hic gostermiyoruz.
export function weeklyWeightRate(
  metrics: BodyMetric[],
  windowDays = RATE_WINDOW_DAYS,
): WeeklyRate | null {
  const points = weightTrend(metrics);
  if (points.length === 0) return null;

  const lastDay = dayNumber(points[points.length - 1].date);
  const recent = points.filter((p) => lastDay - dayNumber(p.date) <= windowDays);
  if (recent.length < MIN_ENTRIES) return null;

  const xs = recent.map((p) => dayNumber(p.date));
  const ys = recent.map((p) => p.weightKg);
  const span = xs[xs.length - 1] - xs[0];
  if (span < MIN_SPAN_DAYS) return null;

  const n = xs.length;
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (xs[i] - meanX) * (ys[i] - meanY);
    denominator += (xs[i] - meanX) ** 2;
  }
  if (denominator === 0) return null;

  const slopePerDay = numerator / denominator;

  const confidence: WeeklyRate['confidence'] =
    n >= 12 && span >= 21 ? 'high' : n >= 7 && span >= 14 ? 'medium' : 'low';

  return {
    kgPerWeek: round(slopePerDay * 7, 2),
    daysCovered: span,
    entries: n,
    confidence,
  };
}