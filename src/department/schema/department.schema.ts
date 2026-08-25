import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DepartmentDocument = HydratedDocument<Department>;

@Schema({ timestamps: true })
export class Department {
  @Prop({
    type: String,
    required: [true, 'Department name is required'],
    trim: true,
    minlength: 2,
    maxlength: 100,
  })
  name: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Hospital',
    required: true,
  })
  hospital_id: Types.ObjectId;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);

// The compound prefix also serves hospital_id-only queries
DepartmentSchema.index(
  { hospital_id: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
