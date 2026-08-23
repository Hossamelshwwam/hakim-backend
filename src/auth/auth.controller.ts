import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  SendVerificationEmailDto,
} from './dto/auth.dto';
import { ApiBody } from '@nestjs/swagger';
import { SkipTenant } from 'src/common/decorator/skip-tenant.decorator';
import { CurrentHospital } from 'src/common/decorator/current-hospital.decorator';

// NOTE: register, login, forgot-password and send-verification-email are
// intentionally NOT @SkipTenant() — identity is per hospital, so they are
// tenant-scoped. The global TenantGuard resolves the hospital from the
// x-tenant-slug header (or subdomain). verify-email / reset-password /
// refresh operate on hashed tokens or the JWT itself, so they stay public.
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: RegisterDto,
    @CurrentHospital() hospitalId: string,
  ) {
    const data = await this.authService.register(body, hospitalId);
    return {
      success: true,
      statusCode: 201,
      data,
      message:
        'Registration successful. Please check your email to verify your account.',
    };
  }

  @Post('login')
  @ApiBody({
    schema: {
      example: {
        email: 'h.elshwwam123@gmail.com',
        password: 'Hossam123!',
      },
    },
  })
  async login(@Body() body: LoginDto, @CurrentHospital() hospitalId: string) {
    const data = await this.authService.login(body, hospitalId);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Login successful.',
    };
  }

  @SkipTenant()
  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    await this.authService.verifyEmail(token);
    return {
      success: true,
      statusCode: 200,
      message: 'Email verified successfully. You can now log in.',
    };
  }

  @Post('send-verification-email')
  async sendVerificationEmail(
    @Body() body: SendVerificationEmailDto,
    @CurrentHospital() hospitalId: string,
  ) {
    await this.authService.sendVerificationEmailAgain(body.email, hospitalId);
    return {
      success: true,
      statusCode: 200,
      message: 'Verification email sent. Please check your email.',
    };
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
    @CurrentHospital() hospitalId: string,
  ) {
    await this.authService.forgotPassword(body.email, hospitalId);
    return {
      success: true,
      statusCode: 200,
      message: 'Password reset link sent. Please check your email.',
    };
  }

  @SkipTenant()
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPassword(body.token, body.password);
    return {
      success: true,
      statusCode: 200,
      message: 'Password reset successfully. You can now log in.',
    };
  }

  @SkipTenant()
  @Post('refresh')
  async refreshToken(@Body() body: RefreshTokenDto) {
    const data = await this.authService.refreshAccessToken(body.refreshToken);
    return {
      success: true,
      statusCode: 200,
      message: 'Token refreshed successfully.',
      data,
    };
  }
}
