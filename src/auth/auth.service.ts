import { MailerService } from '@nestjs-modules/mailer';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDocument } from '../user/schema/user.schema';
import { UserService } from '../user/user.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import bcrypt from 'bcryptjs';
import { JwtMethodsService } from './services/jwt-methods.service';
import crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    private readonly userService: UserService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly jwtMethodsService: JwtMethodsService,
  ) {}

  async sendVerificationEmail(to: string, name: string, token: string) {
    await this.mailerService.sendMail({
      to,
      subject: 'Verify your Hakim account',
      html: `
      <h2>Hi ${name},</h2>
      <p>
        Click the link below to verify your email.
        This link expires in 24 hours.
      </p>

      <a
        href="${this.configService.get<string>('CLIENT_URL')}/verify-email?token=${token}"
        style="
          padding:12px 24px;
          background:#E94560;
          color:#fff;
          border-radius:6px;
          text-decoration:none;
          display:inline-block;
        "
      >
        Verify Email
      </a>
    `,
    });
  }

  async sendPasswordResetEmail(to: string, name: string, token: string) {
    await this.mailerService.sendMail({
      to,
      subject: 'Reset your Hakim password',

      html: `
      <h2>Hi ${name},</h2>

      <p>
        Click the link below to reset your password.
        This link expires in 1 hour.
      </p>

      <a
        href="${this.configService.get<string>('CLIENT_URL')}/reset-password?token=${token}"
        style="
          padding:12px 24px;
          background:#E94560;
          color:#fff;
          border-radius:6px;
          text-decoration:none;
          display:inline-block;
        "
      >
        Reset Password
      </a>

      <p style="margin-top:16px;">
        If you didn't request this, you can safely ignore this email.
      </p>
    `,
    });
  }
  async hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }

  async register(body: RegisterDto, hospitalId: string) {
    // Identity is per hospital — the same person may exist in others
    const duplicates = await this.userModel.findOne({
      hospital_id: new Types.ObjectId(hospitalId),
      $or: [{ email: body.email }, { phone: body.phone }],
    });
    if (duplicates) {
      if (duplicates.email === body.email.toLowerCase())
        throw new ConflictException(
          'Email already registered in this hospital',
        );
      throw new ConflictException(
        'Phone number already registered in this hospital',
      );
    }

    const passwordHash = await this.hashPassword(body.password);

    const user = new this.userModel({
      name: body.name,
      email: body.email,
      phone: body.phone,
      passwordHash,
      role: body.role,
      // TenantGuard resolved + validated this hospital from x-tenant-slug
      hospital_id: new Types.ObjectId(hospitalId),
    });

    const { verificationTokenExpiry, hashedToken, token } =
      this.userService.generateVerificationToken();

    user.verificationToken = hashedToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    await user.save();

    await this.sendVerificationEmail(user.email, user.name, token);

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  async login(body: LoginDto, hospitalId: string) {
    // Same email may exist in several hospitals — the tenant decides which
    const user = await this.userModel
      .findOne({
        email: body.email,
        hospital_id: new Types.ObjectId(hospitalId),
      })
      .select('+passwordHash');
    if (!user || !user.isActive)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await this.userService.comparePassword(
      body.password,
      user.passwordHash,
    );
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isVerified)
      throw new ForbiddenException(
        'Please verify your email before logging in',
      );

    const accessToken = await this.jwtMethodsService.signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      // Always the resolved hospital — the one the user logged into
      hospitalId,
    });
    const refreshToken = await this.jwtMethodsService.signRefreshToken({
      sub: user._id.toString(),
      role: user.role,
      hospitalId,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async verifyEmail(token: string) {
    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userModel
      .findOne({
        verificationToken: hashed,
        verificationTokenExpiry: { $gt: new Date() },
      })
      .select('+verificationToken +verificationTokenExpiry');

    if (!user)
      throw new BadRequestException('Invalid or expired verification link');

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();
  }

  async sendVerificationEmailAgain(email: string, hospitalId: string) {
    const user = await this.userModel.findOne({
      email,
      hospital_id: new Types.ObjectId(hospitalId),
    });
    if (!user) throw new NotFoundException('User not found');

    const { hashedToken, token, verificationTokenExpiry } =
      this.userService.generateVerificationToken();
    user.verificationToken = hashedToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    await user.save();
    await this.sendVerificationEmail(user.email, user.name, token);
  }

  async forgotPassword(email: string, hospitalId: string) {
    const user = await this.userModel.findOne({
      email,
      hospital_id: new Types.ObjectId(hospitalId),
    });
    if (!user) throw new NotFoundException('User not found');

    const { hashedToken, passwordResetExpiry, token } =
      this.userService.generatePasswordResetToken();

    user.passwordResetToken = hashedToken;
    user.passwordResetExpiry = passwordResetExpiry;
    await user.save();
    await this.sendPasswordResetEmail(user.email, user.name, token);
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await this.userModel
      .findOne({
        passwordResetToken: hashed,
        passwordResetExpiry: { $gt: new Date() },
      })
      .select('+passwordResetToken +passwordResetExpiry +passwordHash');

    if (!user) throw new BadRequestException('Invalid or expired reset link');

    const newPasswordHash = await this.hashPassword(newPassword);

    user.passwordHash = newPasswordHash;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    await user.save();
  }

  async refreshAccessToken(rawRefreshToken: string) {
    const payload = this.jwtMethodsService.verifyRefreshToken(rawRefreshToken);

    const user = await this.userModel
      .findById(payload.sub)
      .select('isActive role hospital_id');
    if (!user || !user.isActive)
      throw new UnauthorizedException('Account not found');

    return {
      accessToken: await this.jwtMethodsService.signAccessToken({
        sub: user._id.toString(),
        role: user.role,
        // Re-read from the DB — never trust a stale claim
        hospitalId: user.hospital_id.toString(),
      }),
    };
  }
}
