import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().min(5).max(20),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  role: z.enum(['patient']).default('patient'),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class LoginDto extends createZodDto(LoginSchema) {}

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

export const sendVerificationEmailSchema = z.object({
  email: z.string().email(),
});

export class SendVerificationEmailDto extends createZodDto(
  sendVerificationEmailSchema,
) {}

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
});

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
