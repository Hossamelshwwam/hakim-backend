import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DoctorDocument = HydratedDocument<Doctor>;

@Schema({ timestamps: true })
export class Doctor {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  user_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Department',
    required: true,
  })
  department_id: Types.ObjectId;

  @Prop({
    type: [Types.ObjectId],
    ref: 'Branch',
    default: [],
  })
  branches: Types.ObjectId[];

  @Prop({ type: String, trim: true, maxlength: 1000 })
  bio?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Hospital',
    required: true,
  })
  hospital_id: Types.ObjectId;
}

export const DoctorSchema = SchemaFactory.createForClass(Doctor);

DoctorSchema.index({ hospital_id: 1 });
DoctorSchema.index({ department_id: 1 });
