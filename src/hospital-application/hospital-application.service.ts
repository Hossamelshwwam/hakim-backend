import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import crypto from 'crypto';
import { HospitalApplicationDocument } from './schema/hospital-application.schema';
import { HospitalDocument } from '../hospital/schema/hospital.schema';
import { UserDocument } from '../user/schema/user.schema';
import {
  ApplyDto,
  ListApplicationsQueryDto,
  RejectApplicationDto,
} from './dto/hospital-application.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { AuthService } from 'src/auth/auth.service';
import { PaymentService } from '../payment/payment.service';
import type { PlanDocument } from '../plan/schema/plan.schema';

@Injectable()
export class HospitalApplicationService {
  constructor(
    @InjectModel('HospitalApplication')
    private readonly applicationModel: Model<HospitalApplicationDocument>,
    @InjectModel('Hospital')
    private readonly hospitalModel: Model<HospitalDocument>,
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    @InjectModel('Plan')
    private readonly planModel: Model<PlanDocument>,
    private readonly authService: AuthService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly paymentService: PaymentService,
  ) {}

  async apply(body: ApplyDto, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Payment proof is required');

    // Plans are DB-managed now — validate the slug early so applications
    // can't be submitted against a deactivated/renamed plan
    const plan = await this.planModel.findOne({
      slug: body.plan,
      isActive: true,
    });
    if (!plan)
      throw new BadRequestException(
        `Plan "${body.plan}" is not available right now`,
      );

    const [existingHospital, existingApplication, pendingDuplicate] =
      await Promise.all([
        this.hospitalModel.findOne({ slug: body.slug }),
        this.applicationModel.findOne({ slug: body.slug, status: 'pending' }),
        // Anti-spam: one PENDING application per owner at a time. Owning
        // several hospitals is allowed — but not in parallel reviews.
        this.applicationModel.findOne({
          status: 'pending',
          $or: [
            { ownerEmail: body.ownerEmail },
            { ownerPhone: body.ownerPhone },
          ],
          slug: { $ne: body.slug },
        }),
      ]);
    if (existingHospital || existingApplication) {
      throw new ConflictException(
        'This slug is already taken or pending review',
      );
    }
    if (pendingDuplicate) {
      throw new ConflictException(
        'You already have an application under review',
      );
    }

    const upload = await this.cloudinaryService.uploadFile(
      file.buffer,
      'payment-proofs',
    );

    // Store the resolved plan reference, not the client-supplied slug string
    const application = await this.applicationModel.create({
      hospitalName: body.hospitalName,
      slug: body.slug,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail,
      ownerPhone: body.ownerPhone,
      billingCycle: body.billingCycle,
      plan_id: plan._id,
      paymentProofUrl: upload.secure_url,
    });

    return application;
  }

  async findAll(query: ListApplicationsQueryDto) {
    const filter = query.status ? { status: query.status } : {};
    return this.applicationModel
      .find(filter)
      .populate('plan_id', 'slug displayName monthlyPrice yearlyPrice currency')
      .sort({ createdAt: -1 });
  }

  async findById(id: string) {
    const application = await this.applicationModel
      .findById(id)
      .populate(
        'plan_id',
        'slug displayName monthlyPrice yearlyPrice currency',
      );
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async approve(id: string, adminId: string) {
    const application = await this.applicationModel.findById(id);
    if (!application) throw new NotFoundException('Application not found');
    if (application.status !== 'pending')
      throw new BadRequestException('Application already reviewed');

    // Re-check slug availability at approval time too (race-condition safety)
    const existingHospital = await this.hospitalModel.findOne({
      slug: application.slug,
    });
    if (existingHospital)
      throw new ConflictException('Slug was taken by another hospital');

    // Resolve the plan FIRST — if it's gone we must fail before creating
    // any hospital/user/ledger records (no orphans)
    const plan = await this.planModel.findOne({
      _id: application.plan_id,
      isActive: true,
    });
    if (!plan)
      throw new BadRequestException(
        'The selected plan is no longer available — reject the application or contact the hospital to re-apply',
      );

    const hospital = await this.hospitalModel.create({
      name: application.hospitalName,
      slug: application.slug,
      status: 'active',
    });

    // Open the financial ledger: first period = approved (the proof was
    // verified during this review), next invoice is generated immediately.
    const billingCycle = application.billingCycle ?? 'monthly';
    const { periodEnd } = await this.paymentService.provisionFirstCycle({
      hospital,
      plan,
      billingCycle,
      startDate: new Date(),
      paymentProofUrl: application.paymentProofUrl,
    });

    // Random password placeholder — user will reset it via emailed link before first login
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await this.authService.hashPassword(randomPassword);

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const passwordResetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h to set password

    const user = await this.userModel.create({
      name: application.ownerName,
      email: application.ownerEmail,
      phone: application.ownerPhone,
      passwordHash,
      role: 'hospital_manager',
      hospital_id: hospital._id,
      isVerified: true, // approved via payment review, skip email verification step
      passwordResetToken: hashedToken,
      passwordResetExpiry,
    });

    application.status = 'approved';
    application.reviewedBy = new Types.ObjectId(adminId);
    application.reviewedAt = new Date();
    application.createdHospitalId = hospital._id;
    await application.save();

    await this.sendApprovalEmail(user.email, user.name, hospital.slug, token, {
      planName: plan.displayName,
      billingCycle,
      amount: billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice,
      currency: plan.currency,
      paidThrough: periodEnd,
    });

    return { hospital, user };
  }

  async reject(id: string, adminId: string, body: RejectApplicationDto) {
    const application = await this.applicationModel.findById(id);
    if (!application) throw new NotFoundException('Application not found');
    if (application.status !== 'pending')
      throw new BadRequestException('Application already reviewed');

    application.status = 'rejected';
    application.reviewedBy = new Types.ObjectId(adminId);
    application.reviewedAt = new Date();
    application.rejectionReason = body.rejectionReason;
    await application.save();

    await this.sendRejectionEmail(
      application.ownerEmail,
      application.ownerName,
      body.rejectionReason,
    );

    return application;
  }

  private async sendApprovalEmail(
    to: string,
    name: string,
    slug: string,
    token: string,
    subscription: {
      planName: string;
      billingCycle: 'monthly' | 'yearly';
      amount: number;
      currency: string;
      paidThrough: Date;
    },
  ) {
    const paidThrough = subscription.paidThrough.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    await this.mailerService.sendMail({
      to,
      subject: 'Your Hakim hospital account is approved!',
      html: `
          <h2>Hi ${name},</h2>
          <p>Your hospital application has been approved.</p>
          <p>
            <strong>${subscription.planName}</strong> plan
            (${subscription.billingCycle} — ${subscription.amount} ${subscription.currency}/cycle)
            active through <strong>${paidThrough}</strong>.
          </p>
          <p>You can manage payments any time from your hospital dashboard.</p>
          <p>Set your password to get started:</p>
          <a href="${this.configService.get('CLIENT_URL')}/reset-password?token=${token}&hospital=${slug}">
            Set Password
          </a>
        `,
    });
  }

  private async sendRejectionEmail(to: string, name: string, reason: string) {
    await this.mailerService.sendMail({
      to,
      subject: 'Update on your Hakim hospital application',
      html: `<h2>Hi ${name},</h2><p>Unfortunately your application was not approved.</p><p>Reason: ${reason}</p>`,
    });
  }
}
