import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ── Booking ──────────────────────────────────────────────────────────────────

export const bookForWalkInSchema = z.object({
  slotId: z.string().min(1),
  patientId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export class BookForWalkInDto extends createZodDto(bookForWalkInSchema) {}

export const bookOnlineSchema = z.object({
  slotId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export class BookOnlineDto extends createZodDto(bookOnlineSchema) {}

// ── Reception confirmation + fee collection ──────────────────────────────────

export const confirmAppointmentSchema = z.object({
  // Defaults to the doctor's examinationFee when omitted
  amount: z.number().min(0).optional(),
});

export class ConfirmAppointmentDto extends createZodDto(
  confirmAppointmentSchema,
) {}

// ── Nurse queue actions ───────────────────────────────────────────────────────

export const statusActionSchema = z.object({
  action: z.enum(['in_consultation', 'completed', 'no_show']),
});

export class StatusActionDto extends createZodDto(statusActionSchema) {}

// ── Queue read ────────────────────────────────────────────────────────────────

export const queueQuerySchema = z.object({
  date: z.coerce.date().optional(),
  departmentId: z.string().min(1).optional(),
  doctorId: z.string().min(1).optional(),
});

export class QueueQueryDto extends createZodDto(queueQuerySchema) {}
