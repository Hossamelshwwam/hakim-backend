import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaymentDocument, buildInvoiceNumber } from './schema/payment.schema';
import type { HospitalDocument } from '../hospital/schema/hospital.schema';
import type { PlanDocument } from '../plan/schema/plan.schema';
import type { BillingCycle } from '../hospital/schema/hospital.schema';
import { ListPaymentsQueryDto } from './dto/payment.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PaginationService } from '../common/services/pagination.service';
import { PaginationMeta } from '../common/types/pagination.type';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// ── UTC-safe period helpers ─────────────────────────────────────────────────

function addMonthsUTC(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp to end of month when the day doesn't exist (e.g. Jan 31 → Feb 28)
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d;
}

function shortLabel(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

function buildPeriodLabel(start: Date, end: Date, cycle: BillingCycle): string {
  if (cycle === 'monthly')
    return MONTH_NAMES[start.getUTCMonth()] + ' ' + start.getUTCFullYear();
  return `${shortLabel(start)} – ${shortLabel(end)}`;
}

export function computePeriodEnd(periodStart: Date, cycle: BillingCycle): Date {
  return addMonthsUTC(periodStart, cycle === 'monthly' ? 1 : 12);
}

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel('Payment')
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel('Hospital')
    private readonly hospitalModel: Model<HospitalDocument>,
    @InjectModel('Plan') private readonly planModel: Model<PlanDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly paginationService: PaginationService,
  ) {}

  // ── Invoice lifecycle ──────────────────────────────────────────────────────

  /**
   * Creates a pending invoice for a period. Idempotent per
   * (hospital, period_start) so cron + manual flows can safely overlap.
   */
  async createPendingInvoice(
    hospital: HospitalDocument,
    plan: PlanDocument,
    cycle: BillingCycle,
    periodStart: Date,
  ) {
    const existing = await this.paymentModel.findOne({
      hospital_id: hospital._id,
      period_start: periodStart,
    });
    if (existing) return existing;

    const periodEnd = computePeriodEnd(periodStart, cycle);
    const amount = cycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;

    return this.paymentModel.create({
      hospital_id: hospital._id,
      plan_slug: plan.slug,
      billing_cycle: cycle,
      period_start: periodStart,
      period_end: periodEnd,
      period_label: buildPeriodLabel(periodStart, periodEnd, cycle),
      amount,
      currency: plan.currency || 'EGP',
      invoice_number: buildInvoiceNumber(String(hospital._id), periodStart),
      status: 'pending',
    });
  }

  /**
   * Makes sure the next unpaid invoice exists once the paid-through date
   * is known (called after approval and by the daily cron).
   */
  async ensureNextInvoice(hospital: HospitalDocument): Promise<void> {
    if (!hospital.plan_id || !hospital.currentPeriodEnd) return;

    const plan = await this.planModel.findById(hospital.plan_id);
    if (!plan || !plan.isActive) return;

    await this.createPendingInvoice(
      hospital,
      plan,
      hospital.billingCycle ?? 'monthly',
      hospital.currentPeriodEnd,
    );
  }

  /**
   * Day-one provisioning used by application approval:
   * records the first (already-paid) period and opens the next invoice.
   */
  async provisionFirstCycle(params: {
    hospital: HospitalDocument;
    plan: PlanDocument;
    billingCycle: BillingCycle;
    startDate: Date;
    paymentProofUrl?: string;
  }) {
    const { hospital, plan, billingCycle, startDate, paymentProofUrl } = params;

    const periodEnd = computePeriodEnd(startDate, billingCycle);

    const firstPayment = await this.paymentModel.findOneAndUpdate(
      {
        hospital_id: hospital._id,
        period_start: startDate,
      },
      {
        $setOnInsert: {
          hospital_id: hospital._id,
          plan_slug: plan.slug,
          billing_cycle: billingCycle,
          period_start: startDate,
          period_end: periodEnd,
          period_label: buildPeriodLabel(startDate, periodEnd, billingCycle),
          amount:
            billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice,
          currency: plan.currency || 'EGP',
          status: 'approved',
          payment_proof_url: paymentProofUrl,
          paid_at: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    hospital.plan_id = plan._id;
    hospital.billingCycle = billingCycle;
    hospital.currentPeriodEnd = periodEnd;
    await hospital.save();

    await this.ensureNextInvoice(hospital);

    return { firstPayment, periodEnd };
  }

  // ── Tenant-side reads ──────────────────────────────────────────────────────

  async findForHospital(
    hospitalId: string,
    query: ListPaymentsQueryDto & { page?: number; limit?: number },
  ) {
    const { skip, limit, page } = this.paginationService.getPagination(
      query.page,
      query.limit,
    );

    const filter: Record<string, unknown> = {
      hospital_id: new Types.ObjectId(hospitalId),
    };
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .sort({ period_start: -1 })
        .skip(skip)
        .limit(limit),
      this.paymentModel.countDocuments(filter),
    ]);

    const pagination: PaginationMeta =
      this.paginationService.buildPaginationMeta(total, page, limit);

    return { items, pagination };
  }

  /** Unpaid invoices for the manager's own hospital (pending + overdue). */
  async getUpcoming(hospitalId: string) {
    return this.paymentModel
      .find({
        hospital_id: new Types.ObjectId(hospitalId),
        status: { $in: ['pending', 'overdue'] },
      })
      .sort({ period_start: 1 });
  }

  async uploadProof(
    hospitalId: string,
    paymentId: string,
    file: Express.Multer.File,
  ) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.hospital_id.toString() !== hospitalId)
      throw new NotFoundException('Payment not found');

    if (!['pending', 'overdue'].includes(payment.status))
      throw new BadRequestException(
        `Cannot upload proof for a ${payment.status} payment`,
      );

    const upload = await this.cloudinaryService.uploadFile(
      file.buffer,
      'payment-proofs',
    );
    payment.payment_proof_url = upload.secure_url;
    await payment.save();

    return payment;
  }

  // ── Platform-admin review ──────────────────────────────────────────────────

  async findAll(
    query: ListPaymentsQueryDto & { page?: number; limit?: number },
  ) {
    const { skip, limit, page } = this.paginationService.getPagination(
      query.page,
      query.limit,
    );

    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.hospitalId)
      filter.hospital_id = new Types.ObjectId(query.hospitalId);
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .populate('hospital_id', 'name slug status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.paymentModel.countDocuments(filter),
    ]);

    const pagination: PaginationMeta =
      this.paginationService.buildPaginationMeta(total, page, limit);

    return { items, pagination };
  }

  async approve(id: string, adminId: string) {
    const payment = await this.paymentModel.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.payment_proof_url)
      throw new BadRequestException('No payment proof uploaded yet');
    if (!['pending', 'overdue'].includes(payment.status))
      throw new BadRequestException(`Payment already ${payment.status}`);

    payment.status = 'approved';
    payment.reviewed_by = new Types.ObjectId(adminId);
    payment.reviewed_at = new Date();
    payment.paid_at = new Date();
    await payment.save();

    const hospital = await this.hospitalModel.findById(payment.hospital_id);
    if (hospital) {
      // Extend paid-through only forward — never shrink on late payments
      if (
        !hospital.currentPeriodEnd ||
        hospital.currentPeriodEnd < payment.period_end
      ) {
        hospital.currentPeriodEnd = payment.period_end;
      }
      if (hospital.status === 'suspended') hospital.status = 'active';
      await hospital.save();
      await this.ensureNextInvoice(hospital);
    }

    return payment;
  }

  async reject(id: string, adminId: string, rejectionReason: string) {
    const payment = await this.paymentModel.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.payment_proof_url)
      throw new BadRequestException('No payment proof uploaded yet');
    if (!['pending', 'overdue'].includes(payment.status))
      throw new BadRequestException(`Payment already ${payment.status}`);

    payment.status = 'rejected';
    payment.reviewed_by = new Types.ObjectId(adminId);
    payment.reviewed_at = new Date();
    payment.rejection_reason = rejectionReason;
    await payment.save();

    // Let the hospital re-upload: reopen as pending proof target
    return payment;
  }

  // ── Financial reporting ────────────────────────────────────────────────────

  async summary() {
    const [collected, byStatus, monthly] = await Promise.all([
      this.paymentModel.aggregate([
        { $match: { status: 'approved' } },
        {
          $group: {
            _id: '$currency',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      this.paymentModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]),
      this.paymentModel.aggregate([
        { $match: { status: 'approved' } },
        {
          $group: {
            _id: {
              year: { $year: '$paid_at' },
              month: { $month: '$paid_at' },
              currency: '$currency',
            },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 },
      ]),
    ]);

    return {
      collectedByCurrency: collected.map((c) => ({
        currency: c._id,
        totalCollected: c.total,
        approvedCount: c.count,
      })),
      byStatus: byStatus.map((s) => ({
        status: s._id,
        count: s.count,
        amount: s.amount,
      })),
      lastTwelveMonths: monthly.map((m) => ({
        year: m._id.year,
        month: m._id.month,
        currency: m._id.currency,
        total: m.total,
        count: m.count,
      })),
    };
  }

  // ── Scheduled jobs (invoked by PaymentCronService) ─────────────────────────

  /** Open the next invoice for every hospital whose period ends within leadDays. */
  async generateUpcomingInvoices(leadDays: number) {
    const now = new Date();
    const horizon = new Date(now.getTime() + leadDays * 24 * 60 * 60 * 1000);

    const hospitals = await this.hospitalModel.find({
      status: 'active',
      plan_id: { $ne: null },
      currentPeriodEnd: { $ne: null, $lte: horizon },
    });

    let created = 0;
    for (const hospital of hospitals) {
      const before = await this.paymentModel.countDocuments({
        hospital_id: hospital._id,
        period_start: hospital.currentPeriodEnd,
      });
      await this.ensureNextInvoice(hospital);
      const after = await this.paymentModel.countDocuments({
        hospital_id: hospital._id,
        period_start: hospital.currentPeriodEnd,
      });
      created += after - before;
    }
    return { scanned: hospitals.length, created };
  }

  /** Flip unpaid invoices to overdue once their coverage period has started. */
  async markOverdue() {
    const result = await this.paymentModel.updateMany(
      { status: 'pending', period_start: { $lte: new Date() } },
      { $set: { status: 'overdue' } },
    );
    return { modified: result.modifiedCount ?? 0 };
  }

  /**
   * Suspend active hospitals whose paid-through date is more than
   * graceDays in the past — TenantGuard blocks suspended tenants.
   */
  async suspendExpiredHospitals(graceDays: number) {
    const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);

    const result = await this.hospitalModel.updateMany(
      {
        status: 'active',
        currentPeriodEnd: { $ne: null, $lt: cutoff },
      },
      { $set: { status: 'suspended' } },
    );
    return { suspended: result.modifiedCount ?? 0 };
  }
}
