import { z } from 'zod';

// Sinirlar veritabani kisitlariyla ayni (body_metrics, profiles).
export const WEIGHT_MIN = 20;
export const WEIGHT_MAX = 400;
export const BODY_FAT_MIN = 3;
export const BODY_FAT_MAX = 70;
export const HEIGHT_MIN = 80;
export const HEIGHT_MAX = 260;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_RE = /^\d+(\.\d*)?$/;

// Cihazin yerel tarihi -> 'YYYY-MM-DD'.
// Sunucudaki current_date UTC oldugu icin tarihi client gonderiyor.
export function localIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "80,5" veya " 80.5 " -> 80.5 | bos -> null | gecersiz -> NaN
export function parseDecimal(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '') return null;
  if (!DECIMAL_RE.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

export const bodyMetricSchema = z
  .object({
    measured_on: z.string().regex(ISO_DATE_RE, 'Gecersiz tarih'),
    weight_kg: z
      .number()
      .min(WEIGHT_MIN, `Kilo ${WEIGHT_MIN}-${WEIGHT_MAX} kg arasinda olmali`)
      .max(WEIGHT_MAX, `Kilo ${WEIGHT_MIN}-${WEIGHT_MAX} kg arasinda olmali`)
      .nullable(),
    body_fat_pct: z
      .number()
      .min(BODY_FAT_MIN, `Yag orani %${BODY_FAT_MIN}-${BODY_FAT_MAX} arasinda olmali`)
      .max(BODY_FAT_MAX, `Yag orani %${BODY_FAT_MIN}-${BODY_FAT_MAX} arasinda olmali`)
      .nullable(),
  })
  .refine((v) => v.weight_kg !== null || v.body_fat_pct !== null, {
    message: 'En az kilo veya yag orani gir',
  });

export type BodyMetricInput = z.infer<typeof bodyMetricSchema>;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type MetricFormInput = {
  measuredOn: string;
  weightText: string;
  bodyFatText: string;
};

// Ekrandaki ham metinleri dogrular. today parametresi test edilebilirlik icin disaridan gelir.
export function validateMetricForm(
  input: MetricFormInput,
  today: string,
): ValidationResult<BodyMetricInput> {
  const weight = parseDecimal(input.weightText);
  const bodyFat = parseDecimal(input.bodyFatText);

  if (Number.isNaN(weight)) {
    return { ok: false, error: 'Kilo icin gecerli bir sayi gir (orn. 80,5)' };
  }
  if (Number.isNaN(bodyFat)) {
    return { ok: false, error: 'Yag orani icin gecerli bir sayi gir (orn. 18)' };
  }

  const parsed = bodyMetricSchema.safeParse({
    measured_on: input.measuredOn,
    weight_kg: weight,
    body_fat_pct: bodyFat,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // ISO tarihler metin olarak dogru siralanir
  if (parsed.data.measured_on > today) {
    return { ok: false, error: 'Gelecek bir tarihe olcum girilemez' };
  }

  return { ok: true, data: parsed.data };
}

export function validateHeight(text: string): ValidationResult<number> {
  const value = parseDecimal(text);
  if (value === null || Number.isNaN(value)) {
    return { ok: false, error: 'Boy icin gecerli bir sayi gir (orn. 175)' };
  }
  if (value < HEIGHT_MIN || value > HEIGHT_MAX) {
    return { ok: false, error: `Boy ${HEIGHT_MIN}-${HEIGHT_MAX} cm arasinda olmali` };
  }
  return { ok: true, data: value };
}