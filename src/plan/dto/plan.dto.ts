import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createPlanSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens',
    ),
  displayName: z.string().min(2).max(80),
  features: z.array(z.string().min(1).max(200)).max(50).default([]),
  monthlyPrice: z.number().min(0),
  yearlyPrice: z.number().min(0),
  currency: z.string().min(2).max(5).default('EGP'),
});

export class CreatePlanDto extends createZodDto(createPlanSchema) {}

export const updatePlanSchema = createPlanSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial();

export class UpdatePlanDto extends createZodDto(updatePlanSchema) {}
