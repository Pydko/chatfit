import { z } from 'zod';

export const setLogSchema = z.object({
  weight_kg: z
    .number({ message: 'Agirlik girilmeli' })
    .min(0, 'Agirlik negatif olamaz')
    .max(1000, 'Agirlik cok yuksek'),
  reps: z
    .number({ message: 'Tekrar girilmeli' })
    .int('Tekrar tam sayi olmali')
    .min(1, 'En az 1 tekrar')
    .max(200, 'Tekrar sayisi cok yuksek'),
  rpe: z
    .number()
    .min(1, 'RPE 1-10 arasi olmali')
    .max(10, 'RPE 1-10 arasi olmali')
    .nullable()
    .optional(),
  is_warmup: z.boolean().optional(),
});

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, 'Hareket adi girilmeli').max(80, 'Ad cok uzun'),
  primary_muscle: z.enum([
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'quads', 'hamstrings', 'glutes', 'calves', 'core',
    'forearms', 'full_body',
  ]),
  equipment: z
    .enum(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other'])
    .nullable()
    .optional(),
});

export type SetLogInput = z.infer<typeof setLogSchema>;
export type ExerciseInput = z.infer<typeof exerciseSchema>;
