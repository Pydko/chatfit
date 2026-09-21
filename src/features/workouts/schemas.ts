import { z } from 'zod';

export const setLogSchema = z.object({
  weight_kg: z
    .number({ message: 'Weight must be entered' })
    .min(0, 'Weight cannot be negative')
    .max(1000, 'Weight is too high'),
  reps: z
    .number({ message: 'Reps must be entered' })
    .int('Reps must be an integer')
    .min(1, 'At least 1 rep')
    .max(200, 'Rep count is too high'),
  rpe: z
    .number()
    .min(1, 'RPE must be between 1-10')
    .max(10, 'RPE must be between 1-10')
    .nullable()
    .optional(),
  is_warmup: z.boolean().optional(),
});

export type SetLogInput = z.infer<typeof setLogSchema>;