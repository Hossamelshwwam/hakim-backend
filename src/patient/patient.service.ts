import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import crypto from 'crypto';
import type { UserDocument } from '../user/schema/user.schema';
import type { PatientDocument } from './schema/patient.schema';
import {
  CreateWalkInPatientDto,
  ListPatientsQueryDto,
} from './dto/patient.dto';
import { PaginationService } from '../common/services/pagination.service';
import { PaginationMeta } from '../common/types/pagination.type';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class PatientService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    @InjectModel('Patient')
    private readonly patientModel: Model<PatientDocument>,
    private readonly paginationService: PaginationService,
  ) {}

  /**
   * Walk-in registration by reception. The account starts WITHOUT usable
   * credentials — the patient claims it later from the website (phone
   * matching in AuthService.register) but is immediately bookable.
   */
  async registerWalkIn(hospitalId: string, body: CreateWalkInPatientDto) {
    const duplicateFilters: Record<string, unknown>[] = [{ phone: body.phone }];
    if (body.email) duplicateFilters.push({ email: body.email.toLowerCase() });

    const existing = await this.userModel.findOne({
      hospital_id: new Types.ObjectId(hospitalId),
      $or: duplicateFilters,
    });
    if (existing)
      throw new ConflictException(
        'Phone or email already registered in this hospital',
      );

    // Unusable placeholder password until the patient claims the account
    const passwordHash = await this.hashPlaceholder();

    const user = await this.userModel.create({
      name: body.name,
      email: body.email,
      phone: body.phone,
      passwordHash,
      role: 'patient',
      hospital_id: new Types.ObjectId(hospitalId),
      isVerified: false,
    });

    const patient = await this.patientModel.create({
      user_id: user._id,
      hospital_id: new Types.ObjectId(hospitalId),
      dateOfBirth: body.dateOfBirth,
      gender: body.gender,
    });

    return {
      user: this.sanitize(user),
      patient,
    };
  }

  async findAll(
    hospitalId: string,
    query: ListPatientsQueryDto & { page?: number; limit?: number },
  ) {
    const { skip, limit, page } = this.paginationService.getPagination(
      query.page,
      query.limit,
    );

    const filter: Record<string, unknown> = {
      hospital_id: new Types.ObjectId(hospitalId),
      role: 'patient',
    };
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: rx }, { phone: rx }];
    }

    const [patients, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.userModel.countDocuments(filter),
    ]);

    const pagination: PaginationMeta =
      this.paginationService.buildPaginationMeta(total, page, limit);

    // Merge demographic profiles
    const userIds = patients.map((p) => p._id);
    const profiles = await this.patientModel.find({
      user_id: { $in: userIds },
    });
    const profileByUser = new Map(
      profiles.map((pr) => [pr.user_id.toString(), pr]),
    );

    const items = patients.map((p) => {
      const clean = this.sanitize(p);
      const profile = profileByUser.get(String(p._id));
      return profile ? { ...clean, profile } : clean;
    });

    return { items, pagination };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async hashPlaceholder() {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(crypto.randomBytes(16).toString('hex'), 12);
  }

  private sanitize(user: UserDocument) {
    const obj = user.toObject() as unknown as Record<string, unknown>;
    delete obj.passwordHash;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpiry;
    delete obj.verificationToken;
    delete obj.verificationTokenExpiry;
    return obj;
  }
}
