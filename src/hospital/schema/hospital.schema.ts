// hospital/schema/hospital.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type HospitalDocument = HydratedDocument<Hospital>;

export type BillingCycle = 'monthly' | 'yearly';

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

  // ── Profile ─────────────────────────────────────────────────────────────────
  @Prop({ type: String, trim: true })
  phone?: string;

  @Prop({
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  })
  email?: string;

  @Prop({ type: String, trim: true, maxlength: 300 })
  address?: string;

  @Prop({ type: String, trim: true })
  logoUrl?: string;

  @Prop({ type: Types.ObjectId, ref: 'Plan' })
  plan_id?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly',
  })
  billingCycle?: BillingCycle;

  // Paid-through date: end of the last approved payment period
  @Prop({ type: Date })
  currentPeriodEnd?: Date;

  // When true, doctors must confirm "patient presented with me" in the queue
  @Prop({ type: Boolean, default: false })
  requireDoctorConfirmation?: boolean;
}

export const HospitalSchema = SchemaFactory.createForClass(Hospital);

HospitalSchema.index({ slug: 1 }, { unique: true });
