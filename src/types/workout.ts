export type PrimaryMuscle =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core'
  | 'forearms' | 'full_body';

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable'
  | 'bodyweight' | 'kettlebell' | 'band' | 'other';

export type Exercise = {
  id: string;
  owner_id: string | null;
  name: string;
  primary_muscle: PrimaryMuscle;
  equipment: Equipment | null;
  is_unilateral: boolean;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  performed_at: string;
  title: string | null;
  notes: string | null;
  duration_minutes: number | null;
};

export type SetLog = {
  id: string;
  user_id: string;
  session_id: string;
  exercise_id: string;
  set_index: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  performed_at: string;
};

export const MUSCLE_LABELS: Record<PrimaryMuscle, string> = {
  chest: 'Gogus',
  back: 'Sirt',
  shoulders: 'Omuz',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'On Bacak',
  hamstrings: 'Arka Bacak',
  glutes: 'Kalca',
  calves: 'Baldir',
  core: 'Karin',
  forearms: 'On Kol',
  full_body: 'Tum Vucut',
};
