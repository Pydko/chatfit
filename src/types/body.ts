export type BodyMetric = {
  id: string;
  user_id: string;
  measured_on: string; // YYYY-MM-DD
  weight_kg: number | null;
  body_fat_pct: number | null;
  created_at: string;
};