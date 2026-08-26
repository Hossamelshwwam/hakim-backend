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
import { AppointmentService } from './appointment.service';
import {
  BookForWalkInDto,
  BookOnlineDto,
  ConfirmAppointmentDto,
  QueueQueryDto,
  StatusActionDto,
} from './dto/appointment.dto';
import { AuthRoles } from '../common/decorator/auth-roles.decorator';
import { CurrentHospital } from '../common/decorator/current-hospital.decorator';
import { CurrentUser } from '../common/decorator/current-user.decorator';
import type { AuthUser } from '../common/types/user.type';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  // ── Booking ────────────────────────────────────────────────────────────────

  // Reception books a walk-in / registered patient into a slot
  @Post()
  @AuthRoles('receptionist', 'hospital_manager')
  async bookForWalkIn(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: BookForWalkInDto,
  ) {
    const data = await this.appointmentService.bookForWalkIn(
      hospitalId,
      user,
      body,
    );
    return {
      success: true,
      statusCode: 201,
      data,
      message:
        'Appointment booked. It enters the queue once reception confirms it and collects the fee.',
    };
  }

  // Patient self-booking from the website
  @Post('online')
  @AuthRoles('patient')
  async bookOnline(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: BookOnlineDto,
  ) {
    const data = await this.appointmentService.bookOnline(
      hospitalId,
      user,
      body,
    );
    return {
      success: true,
      statusCode: 201,
      data,
      message:
        'Appointment booked. Please visit the reception on arrival to confirm and pay.',
    };
  }

  // ── Queue (declared BEFORE :id routes) ────────────────────────────────────

  @Get('queue')
  @AuthRoles('receptionist', 'nurse', 'doctor', 'hospital_manager')
  async getQueue(
    @CurrentHospital() hospitalId: string,
    @Query() query: QueueQueryDto,
  ) {
    const data = await this.appointmentService.getQueue(hospitalId, query);
    return {
      success: true,
      statusCode: 200,
      ...data,
      message: 'Queue fetched successfully',
    };
  }

  // ── Listing ─────────────────────────────────────────────────────────────────

  @Get()
  @AuthRoles()
  async findAll(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: { status?: string; page?: number; limit?: number },
  ) {
    const data = await this.appointmentService.findAll(hospitalId, user, query);
    return {
      success: true,
      statusCode: 200,
      ...data,
      message: 'Appointments fetched successfully',
    };
  }

  // ── Lifecycle actions ───────────────────────────────────────────────────────

  // Reception confirms arrival + collects the examination fee
  @Post(':id/confirm')
  @AuthRoles('receptionist', 'hospital_manager')
  async confirmAndCollect(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ConfirmAppointmentDto,
  ) {
    const data = await this.appointmentService.confirmAndCollect(
      hospitalId,
      id,
      user,
      body,
    );
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Appointment confirmed and fee collected',
    };
  }

  // Nurse marks the patient who may enter now (stamps who did it)
  @Patch(':id/status')
  @AuthRoles('nurse', 'hospital_manager')
  async updateStatus(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: StatusActionDto,
  ) {
    let data;
    let message;

    if (body.action === 'in_consultation') {
      data = await this.appointmentService.markInConsultation(
        hospitalId,
        id,
        user,
      );
      message = 'Patient called in';
    } else if (body.action === 'completed') {
      data = await this.appointmentService.markCompleted(hospitalId, id, user);
      message = 'Appointment completed';
    } else if (body.action === 'no_show') {
      data = await this.appointmentService.markNoShow(hospitalId, id);
      message = 'Patient marked as no-show';
    }

    return {
      success: true,
      statusCode: 200,
      data,
      message,
    };
  }

  // Optional doctor confirmation — only when the hospital enables it
  @Post(':id/attend')
  @AuthRoles('doctor')
  async attend(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.appointmentService.attend(hospitalId, id, user);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Attendance confirmed',
    };
  }

  @Patch(':id/cancel')
  @AuthRoles('patient', 'receptionist', 'hospital_manager')
  async cancel(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.appointmentService.cancel(hospitalId, id, user);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Appointment cancelled',
    };
  }
}
