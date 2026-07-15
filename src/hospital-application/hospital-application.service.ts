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

@Injectable()
export class HospitalApplicationService {
  constructor(
    @InjectModel('HospitalApplication')
    private readonly applicationModel: Model<HospitalApplicationDocument>,
    @InjectModel('Hospital')
    private readonly hospitalModel: Model<HospitalDocument>,
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    private readonly authService: AuthService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async apply(body: ApplyDto, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Payment proof is required');

    const [existingHospital, existingApplication] = await Promise.all([
      this.hospitalModel.findOne({ slug: body.slug }),
      this.applicationModel.findOne({ slug: body.slug, status: 'pending' }),
    ]);
    if (existingHospital || existingApplication) {
      throw new ConflictException(
        'This slug is already taken or pending review',
      );
    }

    const upload = await this.cloudinaryService.uploadFile(
      file.buffer,
      'payment-proofs',
    );

    const application = await this.applicationModel.create({
      ...body,
      paymentProofUrl: upload.secure_url,
    });

    return application;
  }

  async findAll(query: ListApplicationsQueryDto) {
    const filter = query.status ? { status: query.status } : {};
    return this.applicationModel.find(filter).sort({ createdAt: -1 });
  }

  async findById(id: string) {
    const application = await this.applicationModel.findById(id);
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

    const hospital = await this.hospitalModel.create({
      name: application.hospitalName,
      slug: application.slug,
      status: 'active',
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

    await this.sendApprovalEmail(user.email, user.name, hospital.slug, token);

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
  ) {
    await this.mailerService.sendMail({
      to,
      subject: 'Your Hakim hospital account is approved!',
      html: `
          <h2>Hi ${name},</h2>
          <p>Your hospital application has been approved. Set your password to get started:</p>
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
