import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Gecerli bir e-posta gir'),
  password: z
    .string()
    .min(10, 'Sifre en az 10 karakter olmali')
    .regex(/[a-zA-Z]/, 'Sifre en az bir harf icermeli')
    .regex(/[0-9]/, 'Sifre en az bir rakam icermeli'),
});

export type Credentials = z.infer<typeof credentialsSchema>;