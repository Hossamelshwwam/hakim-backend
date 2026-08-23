import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const listApplicationsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

export class ListApplicationsQueryDto extends createZodDto(
  listApplicationsQuerySchema,
) {}

export const applySchema = z.object({
  hospitalName: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens',
    ),
  ownerName: z.string().min(2).max(80),
  ownerEmail: z.string().email(),
  ownerPhone: z.string().min(5).max(20),
  plan: z.enum(['basic', 'pro', 'enterprise']),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
});

export class ApplyDto extends createZodDto(applySchema) {}

export const rejectApplicationSchema = z.object({
  rejectionReason: z.string().min(3).max(300),
});

export class RejectApplicationDto extends createZodDto(
  rejectApplicationSchema,
) {}
