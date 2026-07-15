import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createHospitalSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens',
    ),
});

export class CreateHospitalDto extends createZodDto(createHospitalSchema) {}

export const updateHospitalSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

export class UpdateHospitalDto extends createZodDto(updateHospitalSchema) {}
