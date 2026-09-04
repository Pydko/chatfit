import { z } from 'zod';

export const chatMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Mesaj bos olamaz')
    .max(2000, 'Mesaj cok uzun (en fazla 2000 karakter)'),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;