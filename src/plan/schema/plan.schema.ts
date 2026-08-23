import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlanDocument = HydratedDocument<Plan>;

@Schema({ timestamps: true })
export class Plan {
  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens',
    ],
  })
  slug: string; // basic | pro | enterprise

  @Prop({
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    minlength: 2,
    maxlength: 80,
  })
  displayName: string;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({
    type: Number,
    required: [true, 'Monthly price is required'],
    min: 0,
  })
  monthlyPrice: number;

  @Prop({
    type: Number,
    required: [true, 'Yearly price is required'],
    min: 0,
  })
  yearlyPrice: number;

  @Prop({ type: String, default: 'EGP', uppercase: true, trim: true })
  currency: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);

PlanSchema.index({ slug: 1 }, { unique: true });
