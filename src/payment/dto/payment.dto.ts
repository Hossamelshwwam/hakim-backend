import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const listPaymentsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'overdue']).optional(),
  hospitalId: z.string().min(1).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export class ListPaymentsQueryDto extends createZodDto(
  listPaymentsQuerySchema,
) {}

export const rejectPaymentSchema = z.object({
  rejectionReason: z.string().min(3).max(300),
});

export class RejectPaymentDto extends createZodDto(rejectPaymentSchema) {}
