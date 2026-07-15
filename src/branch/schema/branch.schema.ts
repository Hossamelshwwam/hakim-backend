// branch/schema/branch.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BranchDocument = HydratedDocument<Branch>;

@Schema({ timestamps: true })
export class Branch {
  @Prop({
    type: String,
    required: [true, 'Branch name is required'],
    trim: true,
    minlength: 2,
    maxlength: 120,
  })
  name: string;

  @Prop({
    type: String,
    required: [true, 'Address is required'],
    trim: true,
  })
  address: string;

  @Prop({
    type: String,
    trim: true,
  })
  phone?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Hospital',
    required: true,
  })
  hospital_id: Types.ObjectId;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);

BranchSchema.index({ hospital_id: 1 });
