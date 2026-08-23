import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'overdue';

@Schema({ timestamps: true })
export class Payment {
  @Prop({
    type: Types.ObjectId,
    ref: 'Hospital',
    required: true,
  })
  hospital_id: Types.ObjectId;

  // Snapshot of the plan at invoice time — prices may change later,
  // the ledger must stay historically accurate
  @Prop({ type: String, required: true, trim: true, lowercase: true })
  plan_slug: string;

  @Prop({
    type: String,
    enum: ['monthly', 'yearly'],
    required: true,
  })
  billing_cycle: 'monthly' | 'yearly';

  // Period this payment covers
  // monthly: 2026-06-01 → 2026-07-01 | yearly: 2026-06-01 → 2027-06-01
  @Prop({ type: Date, required: true })
  period_start: Date;

  @Prop({ type: Date, required: true })
  period_end: Date;

  // Human-readable label e.g. "June 2026" or "Jun 2026 – Jun 2027"
  @Prop({ type: String, required: true, trim: true })
  period_label: string;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  @Prop({ type: String, default: 'EGP', uppercase: true })
  currency: string;

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected', 'overdue'],
    default: 'pending',
  })
  status: PaymentStatus;

  @Prop({ type: String, trim: true })
  payment_proof_url?: string;

  @Prop({ type: String, required: true, unique: true, trim: true })
  invoice_number: string; // INV-{hospitalId}-{YYYYMM}

  @Prop({ type: Types.ObjectId, ref: 'PlatformAdmin' })
  reviewed_by?: Types.ObjectId;

  @Prop({ type: Date })
  reviewed_at?: Date;

  @Prop({ type: String, trim: true })
  rejection_reason?: string;

  @Prop({ type: Date })
  paid_at?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ hospital_id: 1 });
// One invoice per hospital per period start
PaymentSchema.index({ hospital_id: 1, period_start: 1 }, { unique: true });
PaymentSchema.index({ status: 1 });

export function buildInvoiceNumber(
  hospitalSlug: string,
  periodStart: Date,
): string {
  const y = periodStart.getUTCFullYear();
  const m = String(periodStart.getUTCMonth() + 1).padStart(2, '0');
  return `INV-${hospitalSlug}-${y}${m}`;
}
