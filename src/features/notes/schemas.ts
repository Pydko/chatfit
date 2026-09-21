import { z } from 'zod';

// Limits are kept identical to database constraints.
export const noteSchema = z.object({
  title: z
    .string()
    .trim()
    .max(120, 'Title is too long (maximum 120 characters)')
    .nullable(),
  body: z
    .string()
    .trim()
    .min(1, 'Note cannot be empty')
    .max(20000, 'Note is too long (maximum 20000 characters)'),
});

export type NoteInput = z.infer<typeof noteSchema>;