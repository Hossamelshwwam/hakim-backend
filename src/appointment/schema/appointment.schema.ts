import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AppointmentDocument = HydratedDocument<Appointment>;

export type AppointmentStatus =
  | 'booked'
  | 'confirmed'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

@Schema({ timestamps: true })
export class Appointment {
  @Prop({
    type: Types.ObjectId,
    ref: 'Patient',
    required: true,
  })
  patient_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Doctor',
    required: true,
  })
  doctor_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Branch',
    required: true,
  })
  branch_id: Types.ObjectId;

  // The concrete ScheduleSlot occurrence holding the seat
  @Prop({
    type: Types.ObjectId,
    ref: 'ScheduleSlot',
    required: true,
  })
  schedule_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: [
      'booked',
      'confirmed',
      'in_consultation',
      'completed',
      'cancelled',
      'no_show',
    ],
    default: 'booked',
  })
  status: AppointmentStatus;

  // Who created it and through which channel
  @Prop({
    type: String,
    enum: ['reception', 'online'],
    required: true,
  })
  bookedVia: 'reception' | 'online';

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  // ── Reception confirmation + payment (drives the queue order) ──────────────
  @Prop({ type: Types.ObjectId, ref: 'User' })
  collectedBy?: Types.ObjectId;

  @Prop({ type: Date })
  collectedAt?: Date;

  @Prop({ type: Number, min: 0 })
  feeAmount?: number;

  @Prop({ type: Date })
  confirmedAt?: Date;

  // ── Nurse queue stamp ("this patient may enter now") ────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'User' })
  calledBy?: Types.ObjectId;

  @Prop({ type: Date })
  calledAt?: Date;

  // ── Optional doctor attendance confirmation ─────────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'User' })
  attendedBy?: Types.ObjectId;

  @Prop({ type: Date })
  attendedAt?: Date;

  // ── Cancellation audit ──────────────────────────────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'User' })
  cancelledBy?: Types.ObjectId;

  @Prop({ type: Date })
  cancelledAt?: Date;

  @Prop({ type: String, trim: true, maxlength: 500 })
  notes?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Hospital',
    required: true,
  })
  hospital_id: Types.ObjectId;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);

AppointmentSchema.index({ hospital_id: 1 });
// One ACTIVE booking per patient per slot — cancellations free the seat
AppointmentSchema.index(
  { schedule_id: 1, patient_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['booked', 'confirmed', 'in_consultation'] },
    },
  },
);
AppointmentSchema.index({ doctor_id: 1 });
AppointmentSchema.index({ patient_id: 1 });
