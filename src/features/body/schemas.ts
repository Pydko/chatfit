import { z } from 'zod';

// Limits are identical to database constraints (body_metrics, profiles).
export const WEIGHT_MIN = 20;
export const WEIGHT_MAX = 400;
export const BODY_FAT_MIN = 3;
export const BODY_FAT_MAX = 70;
export const HEIGHT_MIN = 80;
export const HEIGHT_MAX = 260;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_RE = /^\d+(\.\d*)?$/;

// Device local date -> 'YYYY-MM-DD'.
// Since server current_date is UTC, the client sends the date.
export function localIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "80,5" or " 80.5 " -> 80.5 | empty -> null | invalid -> NaN
export function parseDecimal(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '') return null;
  if (!DECIMAL_RE.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

export const bodyMetricSchema = z
  .object({
    measured_on: z.string().regex(ISO_DATE_RE, 'Invalid date'),
    weight_kg: z
      .number()
      .min(WEIGHT_MIN, `Weight must be between ${WEIGHT_MIN} and ${WEIGHT_MAX} kg`)
      .max(WEIGHT_MAX, `Weight must be between ${WEIGHT_MIN} and ${WEIGHT_MAX} kg`)
      .nullable(),
    body_fat_pct: z
      .number()
      .min(BODY_FAT_MIN, `Body fat must be between %${BODY_FAT_MIN} and %${BODY_FAT_MAX}`)
      .max(BODY_FAT_MAX, `Body fat must be between %${BODY_FAT_MIN} and %${BODY_FAT_MAX}`)
      .nullable(),
  })
  .refine((v) => v.weight_kg !== null || v.body_fat_pct !== null, {
    message: 'Enter at least weight or body fat percentage',
  });

export type BodyMetricInput = z.infer<typeof bodyMetricSchema>;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type MetricFormInput = {
  measuredOn: string;
  weightText: string;
  bodyFatText: string;
};

// Validates raw text inputs from the screen. today parameter comes from outside for testability.
export function validateMetricForm(
  input: MetricFormInput,
  today: string,
): ValidationResult<BodyMetricInput> {
  const weight = parseDecimal(input.weightText);
  const bodyFat = parseDecimal(input.bodyFatText);

  if (Number.isNaN(weight)) {
    return { ok: false, error: 'Enter a valid number for weight (e.g. 80.5)' };
  }
  if (Number.isNaN(bodyFat)) {
    return { ok: false, error: 'Enter a valid number for body fat (e.g. 18)' };
  }

  const parsed = bodyMetricSchema.safeParse({
    measured_on: input.measuredOn,
    weight_kg: weight,
    body_fat_pct: bodyFat,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // ISO dates sort correctly as strings
  if (parsed.data.measured_on > today) {
    return { ok: false, error: 'Cannot enter a measurement for a future date' };
  }

  return { ok: true, data: parsed.data };
}

export function validateHeight(text: string): ValidationResult<number> {
  const value = parseDecimal(text);
  if (value === null || Number.isNaN(value)) {
    return { ok: false, error: 'Enter a valid number for height (e.g. 175)' };
  }
  if (value < HEIGHT_MIN || value > HEIGHT_MAX) {
    return { ok: false, error: `Height must be between ${HEIGHT_MIN} and ${HEIGHT_MAX} cm` };
  }
  return { ok: true, data: value };
}