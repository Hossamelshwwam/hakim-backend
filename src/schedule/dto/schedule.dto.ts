import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createScheduleTemplateSchema = z
  .object({
    type: z.enum(['custom', 'repeated']),
    // Required when a MANAGER creates on behalf of a doctor; ignored for
    // doctor-role callers (their own profile is used)
    doctorId: z.string().min(1).optional(),
    branchId: z.string().min(1),
    startTime: z.string().regex(timeRegex, 'Use HH:mm format'),
    endTime: z.string().regex(timeRegex, 'Use HH:mm format'),
    capacity: z.number().int().min(1).optional(),

    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    repeatFrom: z.coerce.date().optional(),

    date: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startTime >= data.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'endTime must be after startTime',
      });
    }
    if (data.type === 'custom' && !data.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date'],
        message: 'date is required for custom slots',
      });
    }
    if (data.type === 'repeated') {
      if (!data.daysOfWeek?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['daysOfWeek'],
          message:
            'daysOfWeek is required for repeated slots (0 = Sunday … 6 = Saturday)',
        });
      }
    }
  });

export class CreateScheduleTemplateDto extends createZodDto(
  createScheduleTemplateSchema,
) {}

export const listSlotsQuerySchema = z.object({
  doctorId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  onlyAvailable: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export class ListSlotsQueryDto extends createZodDto(listSlotsQuerySchema) {}
