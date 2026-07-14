import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { UserDocument } from './schema/user.schema';
import { Model } from 'mongoose';
import {
  GetAllAdminsQueryDto,
  UpdateAdminDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './dto/user-dto';
import { PaginationService } from '../common/services/pagination.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    private readonly paginationService: PaginationService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  comparePassword(plain: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plain, passwordHash);
  }

  generateVerificationToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return { token, hashedToken, verificationTokenExpiry };
  }

  generatePasswordResetToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);
    return { token, hashedToken, passwordResetExpiry };
  }

  async hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }

  async getMyProfile(userId: string) {
    return await this.userModel.findById(userId).select('-password');
  }

  // ── Update own profile ────────────────────────────────────────────────────────
  async updateMyProfile(userId: string, body: UpdateProfileDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (body.name) user.name = body.name;
    if (body.phone) user.phone = body.phone;

    await user.save();
    return user;
  }

  async uploadUserImage(userId: string, file: Express.Multer.File) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Category not found');

    if (user.avatar)
      await this.cloudinaryService.deleteFile(user.avatar).catch(() => null);

    const image = await this.cloudinaryService.uploadFile(
      file.buffer,
      'categories',
    );
    user.avatar = image.secure_url;

    await user.save();
    return { user };
  }

  // ── Change password ───────────────────────────────────────────────────────────
  async changePassword(userId: string, body: ChangePasswordDto) {
    const user = await this.userModel.findById(userId).select('+passwordHash');
    if (!user) throw new NotFoundException('User not found');

    const valid = await this.comparePassword(
      body.currentPassword,
      user.passwordHash,
    );
    if (!valid) throw new NotFoundException('Current password is incorrect');

    const hashPassword = await this.hashPassword(body.newPassword);

    user.passwordHash = hashPassword;
    await user.save();
  }

  // ── Admin: list users ─────────────────────────────────────────────────────────
  async getAllAdmins(query: GetAllAdminsQueryDto) {
    const { skip, limit, page } = this.paginationService.getPagination(
      query.page,
      query.limit,
    );

    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.userModel.countDocuments(filter),
    ]);

    return {
      users,
      pagination: this.paginationService.buildPaginationMeta(
        total,
        page,
        limit,
      ),
    };
  }

  // ── Admin: get user detail ────────────────────────────────────────────────────
  async getAdmin(userId: string) {
    const user = await this.userModel.findById(userId).select('-passwordHash');
    if (!user) throw new NotFoundException('User not found');

    return {
      user,
    };
  }

  // ── Admin: suspend / reactivate user ─────────────────────────────────────────
  async updateAdmin(userId: string, body: UpdateAdminDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'admin')
      throw new ForbiddenException('Cannot modify another admin');

    user.isActive = body.isActive;
    await user.save();
    return user;
  }
}
