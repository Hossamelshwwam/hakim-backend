import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import {
  CreateStaffDto,
  ListStaffQueryDto,
  UpdateStaffDto,
} from './dto/staff.dto';
import { AuthRoles } from '../common/decorator/auth-roles.decorator';
import { CurrentHospital } from '../common/decorator/current-hospital.decorator';
import { CurrentUser } from '../common/decorator/current-user.decorator';
import type { AuthUser } from '../common/types/user.type';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // Manager-only: invites doctors, receptionists and nurses
  @Post()
  @AuthRoles('hospital_manager')
  async invite(
    @CurrentHospital() hospitalId: string,
    @Body() body: CreateStaffDto,
  ) {
    const data = await this.staffService.invite(hospitalId, body);
    return {
      success: true,
      statusCode: 201,
      data,
      message:
        'Staff member invited. They will receive an email to set their password.',
    };
  }

  @Get()
  @AuthRoles('hospital_manager')
  async findAll(
    @CurrentHospital() hospitalId: string,
    @Query() query: ListStaffQueryDto,
  ) {
    const data = await this.staffService.findAll(hospitalId, query);
    return {
      success: true,
      statusCode: 200,
      ...data,
      message: 'Staff fetched successfully',
    };
  }

  @Patch(':id/status')
  @AuthRoles('hospital_manager')
  async updateStatus(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
    @Body() body: UpdateStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.staffService.updateStatus(
      hospitalId,
      id,
      body,
      user.userId,
    );
    return {
      success: true,
      statusCode: 200,
      data,
      message: body.isActive
        ? 'Staff member activated'
        : 'Staff member deactivated',
    };
  }
}
