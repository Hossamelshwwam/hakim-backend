import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ScheduleTemplateDocument = HydratedDocument<ScheduleTemplate>;

export type SlotType = 'custom' | 'repeated';

/**
 * Booking rule defined by a doctor (or the manager):
 * - custom   → one concrete date
 * - repeated → weekly pattern (daysOfWeek) materialized into bookable
 *              occurrences on an 8-week rolling horizon
 */
@Schema({ timestamps: true })
export class ScheduleTemplate {
  @Prop({
    type: String,
    enum: ['custom', 'repeated'],
    required: true,
  })
  type: SlotType;

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

  @Prop({
    type: String,
    required: [true, 'Start time is required'],
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format'],
  })
  startTime: string; // "22:00"

  @Prop({
    type: String,
    required: [true, 'End time is required'],
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format'],
  })
  endTime: string; // "23:30"

  // Repeated only — 0 = Sunday … 6 = Saturday
  @Prop({ type: [Number], default: undefined })
  daysOfWeek?: number[];

  // Custom only — the single occurrence date
  @Prop({ type: Date })
  date?: Date;

  // Repeated only — first date occurrences may be generated from
  @Prop({ type: Date })
  repeatFrom?: Date;

  // How far occurrences have already been generated for this template
  @Prop({ type: Date })
  horizonUntil?: Date;

  @Prop({ type: Number, min: 1 })
  capacity?: number; // undefined = unlimited

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({
    type: Types.ObjectId,
    ref: 'Hospital',
    required: true,
  })
  hospital_id: Types.ObjectId;
}

export const ScheduleTemplateSchema =
  SchemaFactory.createForClass(ScheduleTemplate);

ScheduleTemplateSchema.index({ doctor_id: 1, branch_id: 1 });
ScheduleTemplateSchema.index({ hospital_id: 1, isActive: 1 });
