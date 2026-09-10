import { z } from 'zod';

// Sinirlar veritabani kisitlariyla ayni tutuldu.
export const noteSchema = z.object({
  title: z
    .string()
    .trim()
    .max(120, 'Baslik cok uzun (en fazla 120 karakter)')
    .nullable(),
  body: z
    .string()
    .trim()
    .min(1, 'Not bos olamaz')
    .max(20000, 'Not cok uzun (en fazla 20000 karakter)'),
});

export type NoteInput = z.infer<typeof noteSchema>;