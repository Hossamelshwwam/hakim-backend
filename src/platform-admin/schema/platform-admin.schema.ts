import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlatformAdminDocument = HydratedDocument<PlatformAdmin>;

@Schema({ timestamps: true })
export class PlatformAdmin {
  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80,
  })
  name: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  })
  email: string;

  @Prop({ type: String, required: true, select: false })
  passwordHash: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: String, select: false })
  passwordResetToken?: string;

  @Prop({ type: Date, select: false })
  passwordResetExpiry?: Date;
}

export const PlatformAdminSchema = SchemaFactory.createForClass(PlatformAdmin);
