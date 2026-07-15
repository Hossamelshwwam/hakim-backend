// hospital/schema/hospital.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HospitalDocument = HydratedDocument<Hospital>;

@Schema({ timestamps: true })
export class Hospital {
  @Prop({
    type: String,
    required: [true, 'Hospital name is required'],
    trim: true,
    minlength: 2,
    maxlength: 120,
  })
  name: string;

  @Prop({
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens',
    ],
  })
  slug: string;

  @Prop({
    type: String,
    enum: ['active', 'suspended'],
    default: 'active',
  })
  status: string;
}

export const HospitalSchema = SchemaFactory.createForClass(Hospital);

HospitalSchema.index({ slug: 1 }, { unique: true });
