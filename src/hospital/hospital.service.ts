import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HospitalDocument } from './schema/hospital.schema';
import type { PaymentDocument } from '../payment/schema/payment.schema';
import { ListHospitalsQueryDto, UpdateHospitalDto } from './dto/hospital.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PaginationService } from '../common/services/pagination.service';
import { PaginationMeta } from '../common/types/pagination.type';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class HospitalService {
  constructor(
    @InjectModel('Hospital')
    private readonly hospitalModel: Model<HospitalDocument>,
    @InjectModel('Payment')
    private readonly paymentModel: Model<PaymentDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly paginationService: PaginationService,
  ) {}

  // ── Tenant side ────────────────────────────────────────────────────────────

  async getProfile(hospitalId: string) {
    const hospital = await this.hospitalModel
      .findById(hospitalId)
      .populate(
        'plan_id',
        'slug displayName monthlyPrice yearlyPrice currency features',
      );
    if (!hospital) throw new NotFoundException('Hospital not found');

    const unpaidInvoices = await this.paymentModel
      .find({
        hospital_id: hospital._id,
        status: { $in: ['pending', 'overdue'] },
      })
      .sort({ period_start: 1 })
      .select('invoice_number period_label amount currency status period_end');

    return this.withSubscription(hospital, unpaidInvoices);
  }

  async updateProfile(hospitalId: string, body: UpdateHospitalDto) {
    const hospital = await this.hospitalModel.findByIdAndUpdate(
      hospitalId,
      { $set: body },
      { new: true, runValidators: true },
    );
    if (!hospital) throw new NotFoundException('Hospital not found');
    return hospital;
  }

  async uploadLogo(hospitalId: string, file: Express.Multer.File) {
    const hospital = await this.hospitalModel.findById(hospitalId);
    if (!hospital) throw new NotFoundException('Hospital not found');

    if (hospital.logoUrl)
      await this.cloudinaryService
        .deleteFile(hospital.logoUrl)
        .catch(() => null);

    const upload = await this.cloudinaryService.uploadFile(
      file.buffer,
      'hospital-logos',
    );
    hospital.logoUrl = upload.secure_url;
    await hospital.save();
    return hospital;
  }

  // ── Platform-admin side ────────────────────────────────────────────────────

  async adminFindAll(
    query: ListHospitalsQueryDto & { page?: number; limit?: number },
  ) {
    const { skip, limit, page } = this.paginationService.getPagination(
      query.page,
      query.limit,
    );

    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: rx }, { slug: rx }];
    }

    const [hospitals, total] = await Promise.all([
      this.hospitalModel
        .find(filter)
        .populate(
          'plan_id',
          'slug displayName monthlyPrice yearlyPrice currency',
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.hospitalModel.countDocuments(filter),
    ]);

    const pagination: PaginationMeta =
      this.paginationService.buildPaginationMeta(total, page, limit);

    const items = hospitals.map((h) => this.withSubscription(h, []));
    return { items, pagination };
  }

  async adminUpdateStatus(id: string, status: 'active' | 'suspended') {
    const hospital = await this.hospitalModel.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true },
    );
    if (!hospital) throw new NotFoundException('Hospital not found');
    return hospital;
  }

  /** Full profile for one tenant — same detail the manager sees about themselves. */
  async adminFindOne(id: string) {
    return this.getProfile(id);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Attaches a live subscription snapshot to any hospital document. */
  private withSubscription(
    hospital: HospitalDocument,
    unpaidInvoices: PaymentDocument[],
  ) {
    const obj = hospital.toObject();
    const daysRemaining = obj.currentPeriodEnd
      ? Math.ceil(
          (new Date(obj.currentPeriodEnd).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    return {
      ...obj,
      subscription: {
        billingCycle: obj.billingCycle ?? null,
        currentPeriodEnd: obj.currentPeriodEnd ?? null,
        daysRemaining,
        unpaidInvoices,
      },
    };
  }
}
