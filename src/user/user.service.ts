import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { UserDocument } from './schema/user.schema';
import { Model, Types } from 'mongoose';
import { ChangePasswordDto, UpdateProfileDto } from './dto/user-dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Every "me" lookup is scoped to the account's hospital — the JWT carries
   * hospitalId and the binding guard guarantees it matches the tenant header.
   */
  private findScoped(userId: string, hospitalId: string) {
    return this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      hospital_id: new Types.ObjectId(hospitalId),
    });
  }

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

  async getMyProfile(userId: string, hospitalId: string) {
    return this.findScoped(userId, hospitalId)
      .select('-password')
      .populate('hospital_id', 'name slug');
  }

  // ── Update own profile ────────────────────────────────────────────────────────
  async updateMyProfile(
    userId: string,
    hospitalId: string,
    body: UpdateProfileDto,
  ) {
    const user = await this.findScoped(userId, hospitalId);
    if (!user) throw new NotFoundException('User not found');

    if (body.phone && body.phone !== user.phone) {
      // Phone uniqueness is per hospital
      const phoneOwner = await this.userModel.findOne({
        phone: body.phone,
        hospital_id: user.hospital_id,
        _id: { $ne: user._id },
      });
      if (phoneOwner)
        throw new ConflictException(
          'Phone number already registered in this hospital',
        );
    }

    if (body.name) user.name = body.name;
    if (body.phone) user.phone = body.phone;

    await user.save();
    return user;
  }

  async uploadUserImage(
    userId: string,
    hospitalId: string,
    file: Express.Multer.File,
  ) {
    const user = await this.findScoped(userId, hospitalId);
    if (!user) throw new NotFoundException('User not found');

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
  async changePassword(
    userId: string,
    hospitalId: string,
    body: ChangePasswordDto,
  ) {
    const user = await this.findScoped(userId, hospitalId).select(
      '+passwordHash',
    );
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
}
