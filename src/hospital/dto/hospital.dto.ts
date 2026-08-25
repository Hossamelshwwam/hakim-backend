import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Whitelist only — slug/status/plan are never editable through this route
export const updateHospitalSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(5).max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().min(3).max(300).optional(),
});

export class UpdateHospitalDto extends createZodDto(updateHospitalSchema) {}

const paginationFields = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

export const listHospitalsQuerySchema = z.object({
  status: z.enum(['active', 'suspended']).optional(),
  search: z.string().trim().min(2).max(100).optional(),
  ...paginationFields,
});

export class ListHospitalsQueryDto extends createZodDto(
  listHospitalsQuerySchema,
) {}

export const updateHospitalStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

export class UpdateHospitalStatusDto extends createZodDto(
  updateHospitalStatusSchema,
) {}
