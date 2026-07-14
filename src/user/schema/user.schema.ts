import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
})
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
    unique: true,
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
    type: new Types.ObjectId(),
    ref: 'Hospital',
    required: true,
    unique: true,
  })
  hospital_id: string;

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
