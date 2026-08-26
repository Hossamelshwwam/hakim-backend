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
import { ScheduleService } from './schedule.service';
import {
  CreateScheduleTemplateDto,
  ListSlotsQueryDto,
} from './dto/schedule.dto';
import { AuthRoles } from '../common/decorator/auth-roles.decorator';
import { CurrentHospital } from '../common/decorator/current-hospital.decorator';
import { CurrentUser } from '../common/decorator/current-user.decorator';
import type { AuthUser } from '../common/types/user.type';

@ApiTags('Schedule — Templates')
@ApiBearerAuth()
@Controller('schedule/templates')
export class ScheduleTemplateController {
  constructor(private readonly scheduleService: ScheduleService) {}

  // Doctors create their own slots; managers may create on any doctor's behalf
  @Post()
  @AuthRoles('doctor', 'hospital_manager')
  async create(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateScheduleTemplateDto,
  ) {
    const data = await this.scheduleService.createTemplate(
      hospitalId,
      user,
      body,
    );
    return {
      success: true,
      statusCode: 201,
      data,
      message: 'Schedule created and slots materialized',
    };
  }

  // Cancels the WHOLE repeated series (future occurrences only)
  @Patch(':id/deactivate')
  @AuthRoles('doctor', 'hospital_manager')
  async deactivate(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.scheduleService.deactivateSeries(
      hospitalId,
      id,
      user,
    );
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Schedule series deactivated. Future occurrences were closed.',
    };
  }
}

@ApiTags('Schedule — Slots')
@ApiBearerAuth()
@Controller('slots')
export class SlotController {
  constructor(private readonly scheduleService: ScheduleService) {}

  // Availability browser — patients pick from here; staff use it too
  @Get()
  @AuthRoles()
  async findAll(
    @CurrentHospital() hospitalId: string,
    @Query() query: ListSlotsQueryDto,
  ) {
    const data = await this.scheduleService.listSlots(hospitalId, query);
    return {
      success: true,
      statusCode: 200,
      ...data,
      message: 'Slots fetched successfully',
    };
  }

  @Get(':id')
  @AuthRoles()
  async findOne(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
  ) {
    const data = await this.scheduleService.getSlot(hospitalId, id);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Slot fetched successfully',
    };
  }

  // Cancels ONE occurrence (this date only) + its appointments
  @Patch(':id/close')
  @AuthRoles('doctor', 'hospital_manager')
  async closeOccurrence(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.scheduleService.closeOccurrence(
      hospitalId,
      id,
      user,
    );
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Slot closed and its appointments cancelled',
    };
  }
}
