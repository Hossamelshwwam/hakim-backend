import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export type HospitalApplicationDocument = HydratedDocument<HospitalApplication>;

@Schema({ timestamps: true })
export class HospitalApplication {
  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 120,
  })
  hospitalName: string;

  @Prop({
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens',
    ],
  })
  slug: string;

  @Prop({ type: String, required: true, trim: true })
  ownerName: string;

  @Prop({
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  })
  ownerEmail: string;

  @Prop({ type: String, required: true, trim: true })
  ownerPhone: string;

  // Resolved reference to the chosen Plan (clients submit the stable slug;
  // we store the ObjectId so plan edits never orphan applications)
  @Prop({
    type: Types.ObjectId,
    ref: 'Plan',
    required: true,
  })
  plan_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly',
  })
  billingCycle: 'monthly' | 'yearly';

  @Prop({ type: String, required: true })
  paymentProofUrl: string;

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: ApplicationStatus;

  @Prop({ type: Types.ObjectId, ref: 'PlatformAdmin' })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop({ type: String, trim: true })
  rejectionReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'Hospital' })
  createdHospitalId?: Types.ObjectId;
}

export const HospitalApplicationSchema =
  SchemaFactory.createForClass(HospitalApplication);

HospitalApplicationSchema.index({ status: 1 });

// Owner identity is reserved while an application is under review only —
// once rejected, the same owner may apply again
HospitalApplicationSchema.index(
  { ownerEmail: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
HospitalApplicationSchema.index(
  { ownerPhone: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
