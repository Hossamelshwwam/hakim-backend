import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [80, 'Name cannot exceed 80 characters'],
  })
  name: string;

  @Prop({
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  })
  email: string;

  @Prop({ type: String, trim: true })
  avatar?: string;

  @Prop({ type: String, required: true, select: false })
  passwordHash: string;

  @Prop({
    type: String,
    enum: ['doctor', 'patient', 'hospital_manager'],
    default: 'patient',
  })
  role: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Hospital',
    required: true,
  })
  hospital_id: Types.ObjectId;

  @Prop({ type: String, trim: true })
  phone: string;

  @Prop({ type: Boolean, default: false })
  isVerified: boolean;

  @Prop({ type: String, select: false })
  verificationToken?: string;

  @Prop({ type: Date, select: false })
  verificationTokenExpiry?: Date;

  @Prop({ type: String, select: false })
  passwordResetToken?: string;

  @Prop({ type: Date, select: false })
  passwordResetExpiry?: Date;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ role: 1 });
// Email is unique across the whole platform (not just per hospital)
UserSchema.index({ email: 1 }, { unique: true });
// Phone unique when present — many users may have no phone at all
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });
UserSchema.index({ hospital_id: 1, email: 1 }, { unique: true }); // email unique PER hospital
