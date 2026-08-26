import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createWalkInPatientSchema = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().min(5).max(20),
  email: z.string().email().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['male', 'female']).optional(),
});

export class CreateWalkInPatientDto extends createZodDto(
  createWalkInPatientSchema,
) {}

const paginationFields = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

export const listPatientsQuerySchema = z.object({
  search: z.string().trim().min(2).max(100).optional(),
  ...paginationFields,
});

export class ListPatientsQueryDto extends createZodDto(
  listPatientsQuerySchema,
) {}
