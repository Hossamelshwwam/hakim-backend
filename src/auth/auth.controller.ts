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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('register')
  async register(@Body() body: RegisterDto) {
    const data = await this.authService.register(body);
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
        email: 'h.elshwwam123+hospital@gmail.com',
        password: 'Hossam123!',
      },
    },
  })
  async login(@Body() body: LoginDto) {
    const data = await this.authService.login(body);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Login successful.',
    };
  }

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
  async sendVerificationEmail(@Body() body: SendVerificationEmailDto) {
    await this.authService.sendVerificationEmailAgain(body.email);
    return {
      success: true,
      statusCode: 200,
      message: 'Verification email sent. Please check your email.',
    };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.forgotPassword(body.email);
    return {
      success: true,
      statusCode: 200,
      message: 'Password reset link sent. Please check your email.',
    };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPassword(body.token, body.password);
    return {
      success: true,
      statusCode: 200,
      message: 'Password reset successfully. You can now log in.',
    };
  }

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
