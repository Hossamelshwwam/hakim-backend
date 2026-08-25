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
import { HospitalService } from './hospital.service';
import {
  ListHospitalsQueryDto,
  UpdateHospitalStatusDto,
} from './dto/hospital.dto';
import { SkipTenant } from '../common/decorator/skip-tenant.decorator';
import { PlatformAuthGuard } from '../platform-admin/guards/platform-auth.guard';

@ApiTags('Platform Admin — Hospitals')
@ApiBearerAuth()
@SkipTenant()
@UseGuards(PlatformAuthGuard)
@Controller('platform-admin/hospitals')
export class PlatformHospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  @Get()
  async findAll(
    @Query()
    query: ListHospitalsQueryDto & { page?: number; limit?: number },
  ) {
    const data = await this.hospitalService.adminFindAll(query);
    return {
      success: true,
      statusCode: 200,
      ...data,
      message: 'Hospitals fetched successfully',
    };
  }

  // NOTE: declared after the list route; full profile incl. subscription
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.hospitalService.adminFindOne(id);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Hospital fetched successfully',
    };
  }

  // Manual suspension/reactivation — TenantGuard enforces it instantly
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateHospitalStatusDto,
  ) {
    const data = await this.hospitalService.adminUpdateStatus(id, body.status);
    return {
      success: true,
      statusCode: 200,
      data,
      message:
        body.status === 'suspended'
          ? 'Hospital suspended'
          : 'Hospital reactivated',
    };
  }
}
