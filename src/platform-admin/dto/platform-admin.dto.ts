// platform-admin/dto/platform-admin.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const platformAdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class PlatformAdminLoginDto extends createZodDto(
  platformAdminLoginSchema,
) {}

export const platformAdminForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export class PlatformAdminForgotPasswordDto extends createZodDto(
  platformAdminForgotPasswordSchema,
) {}

export const platformAdminResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
});

export class PlatformAdminResetPasswordDto extends createZodDto(
  platformAdminResetPasswordSchema,
) {}
