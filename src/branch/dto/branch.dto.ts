import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(2).max(120),
  address: z.string().min(3).max(300),
  phone: z.string().min(5).max(20).optional(),
});

export class CreateBranchDto extends createZodDto(createBranchSchema) {}

export const updateBranchSchema = createBranchSchema.partial();

export class UpdateBranchDto extends createZodDto(updateBranchSchema) {}

const paginationFields = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

export const listBranchesQuerySchema = z.object({
  search: z.string().trim().min(2).max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  ...paginationFields,
});

export class ListBranchesQueryDto extends createZodDto(
  listBranchesQuerySchema,
) {}
