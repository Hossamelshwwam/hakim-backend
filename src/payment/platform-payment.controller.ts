import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { ListPaymentsQueryDto, RejectPaymentDto } from './dto/payment.dto';
import { SkipTenant } from '../common/decorator/skip-tenant.decorator';
import { PlatformAuthGuard } from '../platform-admin/guards/platform-auth.guard';
import { CurrentPlatformAdmin } from '../platform-admin/decorator/current-platform-admin.decorator';

@ApiTags('Platform Admin — Payments')
@ApiBearerAuth()
@SkipTenant()
@UseGuards(PlatformAuthGuard)
@Controller('platform-admin/payments')
export class PlatformPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // NOTE: declared before :id routes so "summary" is not captured as an id
  @Get('summary')
  async summary() {
    const data = await this.paymentService.summary();
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Payment summary fetched successfully',
    };
  }

  @Get()
  async findAll(@Query() query: ListPaymentsQueryDto) {
    const data = await this.paymentService.findAll(query);
    return {
      success: true,
      statusCode: 200,
      ...data,
      message: 'Payments fetched successfully',
    };
  }

  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @CurrentPlatformAdmin() admin: { adminId: string },
  ) {
    const data = await this.paymentService.approve(id, admin.adminId);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Payment approved',
    };
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: RejectPaymentDto,
    @CurrentPlatformAdmin() admin: { adminId: string },
  ) {
    const data = await this.paymentService.reject(
      id,
      admin.adminId,
      body.rejectionReason,
    );
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Payment rejected',
    };
  }
}
