// platform-admin/platform-admin.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PlatformAdminDocument } from './schema/platform-admin.schema';
import { PlatformAdminLoginDto } from './dto/platform-admin.dto';
import { PlatformJwtMethodsService } from './services/platform-jwt-methods.service';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PlatformAdminService {
  constructor(
    @InjectModel('PlatformAdmin')
    private readonly adminModel: Model<PlatformAdminDocument>,
    private readonly jwtMethodsService: PlatformJwtMethodsService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }

  async comparePassword(plain: string, hash: string) {
    return bcrypt.compare(plain, hash);
  }

  async login(body: PlatformAdminLoginDto) {
    const admin = await this.adminModel
      .findOne({ email: body.email })
      .select('+passwordHash');
    if (!admin || !admin.isActive)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await this.comparePassword(body.password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const accessToken = await this.jwtMethodsService.signAccessToken({
      sub: admin._id.toString(),
    });

    return {
      accessToken,
      admin: { id: admin._id, name: admin.name, email: admin.email },
    };
  }

  async getMe(adminId: string) {
    const admin = await this.adminModel.findById(adminId);
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async forgotPassword(email: string) {
    const admin = await this.adminModel.findOne({ email });
    if (!admin) throw new NotFoundException('Admin not found');

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    admin.passwordResetToken = hashedToken;
    admin.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await admin.save();

    await this.mailerService.sendMail({
      to: admin.email,
      subject: 'Reset your Hakim platform admin password',
      html: `<a href="${this.configService.get('CLIENT_URL')}/platform/reset-password?token=${token}">Reset Password</a>`,
    });
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

    const admin = await this.adminModel
      .findOne({
        passwordResetToken: hashed,
        passwordResetExpiry: { $gt: new Date() },
      })
      .select('+passwordResetToken +passwordResetExpiry +passwordHash');

    if (!admin) throw new BadRequestException('Invalid or expired reset link');

    admin.passwordHash = await this.hashPassword(newPassword);
    admin.passwordResetToken = undefined;
    admin.passwordResetExpiry = undefined;
    await admin.save();
  }
}
