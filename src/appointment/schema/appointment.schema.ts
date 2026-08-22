import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AppointmentDocument = HydratedDocument<Appointment>;

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

  @Prop({
    type: Types.ObjectId,
    ref: 'Schedule',
    required: true,
  })
  schedule_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['confirmed', 'completed', 'cancelled', 'no_show'],
    default: 'confirmed',
  })
  status: string;

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
AppointmentSchema.index({ doctor_id: 1, schedule_id: 1 });
AppointmentSchema.index({ patient_id: 1 });
