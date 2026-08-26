import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const STAFF_ROLES = ['doctor', 'receptionist', 'nurse'] as const;

export const createStaffSchema = z
  .object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    phone: z.string().min(5).max(20).optional(),
    role: z.enum(STAFF_ROLES),
    // Doctor-only fields
    departmentId: z.string().min(1).optional(),
    branchIds: z.array(z.string().min(1)).max(50).optional(),
    examinationFee: z.number().min(0).optional(),
    bio: z.string().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'doctor' && !data.departmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['departmentId'],
        message: 'departmentId is required when inviting a doctor',
      });
    }
  });

export class CreateStaffDto extends createZodDto(createStaffSchema) {}

export const updateStaffSchema = z.object({
  isActive: z.boolean(),
});

export class UpdateStaffDto extends createZodDto(updateStaffSchema) {}

const paginationFields = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

export const listStaffQuerySchema = z.object({
  role: z.enum(STAFF_ROLES).optional(),
  search: z.string().trim().min(2).max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  ...paginationFields,
});

export class ListStaffQueryDto extends createZodDto(listStaffQuerySchema) {}
