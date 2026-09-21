import { z } from 'zod';

export const chatMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message is too long (maximum 2000 characters)'),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;