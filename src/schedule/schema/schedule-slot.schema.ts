import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ScheduleSlotDocument = HydratedDocument<ScheduleSlot>;
/**
 * A concrete, bookable occurrence generated from a ScheduleTemplate.
 * Patients book seats here; capacity enforcement is atomic.
 */
@Schema({ timestamps: true })
export class ScheduleSlot {
  @Prop({
    type: Types.ObjectId,
    ref: 'ScheduleTemplate',
    required: true,
    unique: true,
  })
  template_id: Types.ObjectId;

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

  // UTC midnight of the occurrence day
  @Prop({
    type: Date,
    required: [true, 'Date is required'],
  })
  date: Date;

  @Prop({
    type: String,
    required: true,
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format'],
  })
  startTime: string;

  @Prop({
    type: String,
    required: true,
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format'],
  })
  endTime: string;

  @Prop({ type: Number, min: 1 })
  capacity?: number; // undefined = unlimited

  @Prop({ type: Number, default: 0, min: 0 })
  bookedCount: number;

  @Prop({
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
  })
  status: 'open' | 'closed';

  @Prop({
    type: Types.ObjectId,
    ref: 'Hospital',
    required: true,
  })
  hospital_id: Types.ObjectId;
}

export const ScheduleSlotSchema = SchemaFactory.createForClass(ScheduleSlot);

// One occurrence per template per date — makes materialization idempotent
ScheduleSlotSchema.index({ template_id: 1, date: 1 }, { unique: true });
ScheduleSlotSchema.index({ hospital_id: 1, status: 1, date: 1 });
ScheduleSlotSchema.index({ doctor_id: 1, date: 1 });
ScheduleSlotSchema.index({ branch_id: 1, date: 1 });
