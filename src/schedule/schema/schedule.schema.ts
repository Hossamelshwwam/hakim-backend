import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ScheduleDocument = HydratedDocument<Schedule>;

@Schema({ timestamps: true })
export class Schedule {
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
    type: Date,
    required: [true, 'Date is required'],
  })
  date: Date;

  @Prop({
    type: String,
    required: [true, 'Start time is required'],
  })
  startTime: string; // "13:00"

  @Prop({
    type: String,
    required: [true, 'End time is required'],
  })
  endTime: string; // "15:00"

  @Prop({ type: Number, min: 1 })
  capacity?: number; // optional, undefined = unlimited

  @Prop({ type: Boolean, default: false })
  isClosed: boolean;

  @Prop({
    type: Types.ObjectId,
    ref: 'Hospital',
    required: true,
  })
  hospital_id: Types.ObjectId;
}

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);

ScheduleSchema.index({ hospital_id: 1 });
ScheduleSchema.index({ doctor_id: 1, branch_id: 1, date: 1 });
