import type { BodyMetric } from '@/types/body';
import {
    bodyComposition,
    calculateBmi,
    calculateFfmi,
    dayNumber,
    weeklyWeightRate,
    weightTrend,
    type WeeklyRate,
} from './calculations';
import { localIsoDate } from './schemas';

// Bundan eski olcumler sohbet baglamina girmez: bayat veriye dayali tavsiye yaniltir.
const MAX_STALE_DAYS = 60;

// Sunucuya SADECE sayi gonderiyoruz. Serbest metin yok ki
// prompt'a kullanici yazisi sizamasin; metni Edge Function kuruyor.
export type BodySummary = {
  weightKg: number;
  trendKg: number;
  daysSinceLast: number;
  kgPerWeek?: number;
  rateConfidence?: WeeklyRate['confidence'];
  rateEntries?: number;
  heightCm?: number;
  bmi?: number;
  bodyFatPct?: number;
  bodyFatDaysAgo?: number;
  leanMassKg?: number;
  ffmi?: number;
};

export function buildBodySummary(
  metrics: BodyMetric[],
  heightCm: number | null,
  today: string = localIsoDate(),
): BodySummary | null {
  const points = weightTrend(metrics);
  if (points.length === 0) return null;

  const latest = points[points.length - 1];
  const daysSinceLast = dayNumber(today) - dayNumber(latest.date);
  if (daysSinceLast > MAX_STALE_DAYS) return null;

  const summary: BodySummary = {
    weightKg: latest.weightKg,
    trendKg: latest.trendKg,
    daysSinceLast: Math.max(0, daysSinceLast),
  };

  const rate = weeklyWeightRate(metrics);
  if (rate) {
    summary.kgPerWeek = rate.kgPerWeek;
    summary.rateConfidence = rate.confidence;
    summary.rateEntries = rate.entries;
  }

  if (heightCm !== null && heightCm > 0) {
    summary.heightCm = heightCm;
    const bmi = calculateBmi(latest.weightKg, heightCm);
    if (bmi !== null) summary.bmi = bmi;
  }

  // Kompozisyon icin ayni gun hem kilo hem yag orani olan en son olcum
  const withFat = [...metrics]
    .filter((m) => m.weight_kg !== null && m.body_fat_pct !== null)
    .sort((a, b) => dayNumber(a.measured_on) - dayNumber(b.measured_on))
    .pop();

  if (withFat) {
    const fatDaysAgo = dayNumber(today) - dayNumber(withFat.measured_on);
    const composition = bodyComposition(withFat.weight_kg!, withFat.body_fat_pct!);

    if (composition && fatDaysAgo <= MAX_STALE_DAYS) {
      summary.bodyFatPct = withFat.body_fat_pct!;
      summary.bodyFatDaysAgo = Math.max(0, fatDaysAgo);
      summary.leanMassKg = composition.leanMassKg;

      if (heightCm !== null && heightCm > 0) {
        const ffmi = calculateFfmi(composition.leanMassKg, heightCm);
        if (ffmi) summary.ffmi = ffmi.ffmi;
      }
    }
  }

  return summary;
}