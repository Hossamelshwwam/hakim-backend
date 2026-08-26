import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import crypto from 'crypto';
import type { UserDocument } from '../user/schema/user.schema';
import type { DoctorDocument } from '../doctor/schema/doctor.schema';
import {
  ListStaffQueryDto,
  STAFF_ROLES,
  UpdateStaffDto,
} from './dto/staff.dto';
import { AuthService } from '../auth/auth.service';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { PaginationService } from '../common/services/pagination.service';
import { PaginationMeta } from '../common/types/pagination.type';
import type { ScheduleSlotDocument } from '../schedule/schema/schedule-slot.schema';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class StaffService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    @InjectModel('Doctor') private readonly doctorModel: Model<DoctorDocument>,
    @InjectModel('Department')
    private readonly departmentModel: Model<any>,
    @InjectModel('Branch') private readonly branchModel: Model<any>,
    @InjectModel('Hospital') private readonly hospitalModel: Model<any>,
    @InjectModel('ScheduleSlot')
    private readonly slotModel: Model<ScheduleSlotDocument>,
    private readonly authService: AuthService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly paginationService: PaginationService,
  ) {}

  /**
   * Manager-only invitation. Creates the account with a random placeholder
   * password and emails a set-password link — identical security shape to
   * the hospital-owner onboarding flow.
   */
  async invite(
    hospitalId: string,
    body: {
      name: string;
      email: string;
      phone?: string;
      role: (typeof STAFF_ROLES)[number];
      departmentId?: string;
      branchIds?: string[];
      examinationFee?: number;
      bio?: string;
    },
  ) {
    // Identity is unique per hospital
    const duplicateFilters: Record<string, unknown>[] = [
      { email: body.email.toLowerCase() },
    ];
    if (body.phone) duplicateFilters.push({ phone: body.phone });
    const existing = await this.userModel.findOne({
      hospital_id: new Types.ObjectId(hospitalId),
      $or: duplicateFilters,
    });
    if (existing)
      throw new ConflictException(
        'Email or phone already in use in this hospital',
      );

    // Validate doctor-only extras against this hospital's data
    let departmentId: Types.ObjectId | undefined;
    let branchIds: Types.ObjectId[] = [];
    if (body.role === 'doctor') {
      const department = await this.departmentModel.findOne({
        _id: new Types.ObjectId(body.departmentId),
        hospital_id: new Types.ObjectId(hospitalId),
      });
      if (!department)
        throw new BadRequestException('Department not found in this hospital');
      departmentId = department._id;

      if (body.branchIds?.length) {
        branchIds = body.branchIds.map((b) => new Types.ObjectId(b));
        const branchCount = await this.branchModel.countDocuments({
          _id: { $in: branchIds },
          hospital_id: new Types.ObjectId(hospitalId),
        });
        if (branchCount !== branchIds.length)
          throw new BadRequestException(
            'One or more branches were not found in this hospital',
          );
      }
    }

    // Random placeholder password — real one set via emailed link (24h)
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await this.authService.hashPassword(randomPassword);
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userModel.create({
      name: body.name,
      email: body.email,
      phone: body.phone,
      passwordHash,
      role: body.role,
      hospital_id: new Types.ObjectId(hospitalId),
      isVerified: true, // staff are invited by the manager — no email verification step
      passwordResetToken: hashedToken,
      passwordResetExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    let doctorProfile: DoctorDocument | null = null;
    if (body.role === 'doctor') {
      doctorProfile = await this.doctorModel.create({
        user_id: user._id,
        department_id: departmentId,
        branches: branchIds,
        examinationFee: body.examinationFee,
        bio: body.bio,
        hospital_id: new Types.ObjectId(hospitalId),
      });
    }

    await this.sendInviteEmail(hospitalId, user.email, user.name, token);

    return this.sanitize(user, doctorProfile);
  }
  async findAll(
    hospitalId: string,
    query: ListStaffQueryDto & { page?: number; limit?: number },
  ) {
    const { skip, limit, page } = this.paginationService.getPagination(
      query.page,
      query.limit,
    );

    const filter: Record<string, unknown> = {
      hospital_id: new Types.ObjectId(hospitalId),
      role: { $in: STAFF_ROLES },
    };
    if (query.role) filter.role = query.role;
    if (query.status) filter.isActive = query.status === 'active';
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const [staff, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.userModel.countDocuments(filter),
    ]);

    const pagination: PaginationMeta =
      this.paginationService.buildPaginationMeta(total, page, limit);

    // Merge doctor profiles into their user rows
    const userIds = staff.map((s) => s._id);
    const profiles = await this.doctorModel.find({
      user_id: { $in: userIds },
    });
    const profileByUser = new Map(
      profiles.map((p) => [p.user_id.toString(), p]),
    );

    const items = staff.map((s) => {
      const clean = this.sanitize(s);
      const profile = profileByUser.get(String(s._id));
      return profile ? { ...clean, doctorProfile: profile } : clean;
    });

    return { items, pagination };
  }

  async updateStatus(
    hospitalId: string,
    id: string,
    body: UpdateStaffDto,
    currentUserId: string,
  ) {
    if (id === currentUserId)
      throw new BadRequestException('You cannot change your own status');

    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(id),
      hospital_id: new Types.ObjectId(hospitalId),
      role: { $in: STAFF_ROLES },
    });
    if (!user) throw new NotFoundException('Staff member not found');

    user.isActive = body.isActive;
    await user.save();

    if (!body.isActive && user.role === 'doctor') {
      const doctorProfile = await this.doctorModel.findOne({
        user_id: user._id,
      });
      if (doctorProfile) {
        const now = new Date();
        const todayUTC = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        );
        await this.slotModel.updateMany(
          {
            doctor_id: doctorProfile._id,
            hospital_id: new Types.ObjectId(hospitalId),
            date: { $gte: todayUTC },
            status: 'open',
          },
          { $set: { status: 'closed' } },
        );
      }
    }

    return this.sanitize(user);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Strips credentials/tokens before anything leaves the service. */
  private sanitize(user: UserDocument, doctorProfile?: DoctorDocument | null) {
    const obj = user.toObject() as unknown as Record<string, unknown>;
    delete obj.passwordHash;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpiry;
    delete obj.verificationToken;
    delete obj.verificationTokenExpiry;

    if (doctorProfile) return { ...obj, doctorProfile };
    return obj;
  }

  private async sendInviteEmail(
    hospitalId: string,
    to: string,
    name: string,
    token: string,
  ) {
    const hospital = await this.hospitalModel
      .findById(hospitalId)
      .select('name slug');
    const slug = hospital?.slug ?? '';

    await this.mailerService.sendMail({
      to,
      subject: `You've been added to ${hospital?.name ?? 'Hakim'}`,
      html: `
          <h2>Hi ${name},</h2>
          <p>
            You've been invited to join <strong>${hospital?.name ?? 'a hospital'}</strong> on Hakim.
            Set your password to activate your account (link expires in 24 hours):
          </p>
          <a href="${this.configService.get('CLIENT_URL')}/reset-password?token=${token}&hospital=${slug}">
            Set Password
          </a>
        `,
    });
  }
}
