// platform-admin/platform-admin.controller.ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { PlatformAdminService } from './platform-admin.service';
import {
  PlatformAdminForgotPasswordDto,
  PlatformAdminLoginDto,
  PlatformAdminResetPasswordDto,
} from './dto/platform-admin.dto';
import { SkipTenant } from '../common/decorator/skip-tenant.decorator';
import { PlatformAuthGuard } from './guards/platform-auth.guard';
import { CurrentPlatformAdmin } from './decorator/current-platform-admin.decorator';

@SkipTenant()
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @ApiBody({
    schema: {
      example: {
        email: 'h.elshwwam123@gmail.com',
        password: 'Hossam123!',
      },
    },
  })
  @Post('login')
  async login(@Body() body: PlatformAdminLoginDto) {
    const data = await this.platformAdminService.login(body);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Login successful',
    };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(PlatformAuthGuard)
  async getMe(@CurrentPlatformAdmin() admin: { adminId: string }) {
    const data = await this.platformAdminService.getMe(admin.adminId);
    return { success: true, statusCode: 200, data, message: 'Profile fetched' };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: PlatformAdminForgotPasswordDto) {
    await this.platformAdminService.forgotPassword(body.email);
    return {
      success: true,
      statusCode: 200,
      message: 'Reset link sent if account exists',
    };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: PlatformAdminResetPasswordDto) {
    await this.platformAdminService.resetPassword(body.token, body.password);
    return {
      success: true,
      statusCode: 200,
      message: 'Password reset successfully',
    };
  }
}
