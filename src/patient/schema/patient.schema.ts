import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PatientDocument = HydratedDocument<Patient>;

@Schema({ timestamps: true })
export class Patient {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  user_id: Types.ObjectId;

  @Prop({ type: Date })
  dateOfBirth?: Date;

  @Prop({
    type: String,
    enum: ['male', 'female'],
  })
  gender?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Hospital',
    required: true,
  })
  hospital_id: Types.ObjectId;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);

PatientSchema.index({ hospital_id: 1 });
