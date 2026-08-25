import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().min(2).max(100),
});

export class CreateDepartmentDto extends createZodDto(createDepartmentSchema) {}

export const updateDepartmentSchema = createDepartmentSchema.partial();

export class UpdateDepartmentDto extends createZodDto(updateDepartmentSchema) {}

const paginationFields = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

export const listDepartmentsQuerySchema = z.object({
  search: z.string().trim().min(2).max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  ...paginationFields,
});

export class ListDepartmentsQueryDto extends createZodDto(
  listDepartmentsQuerySchema,
) {}
