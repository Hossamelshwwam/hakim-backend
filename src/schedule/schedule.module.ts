import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleTemplateSchema } from './schema/schedule-template.schema';
import { ScheduleSlotSchema } from './schema/schedule-slot.schema';
import { DoctorSchema } from '../doctor/schema/doctor.schema';
import { BranchSchema } from '../branch/schema/branch.schema';
import { AppointmentSchema } from '../appointment/schema/appointment.schema';
import { ScheduleService } from './schedule.service';
import { ScheduleCronService } from './schedule.cron.service';
import { ScheduleTemplateController, SlotController } from './slot.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ScheduleTemplate', schema: ScheduleTemplateSchema },
      { name: 'ScheduleSlot', schema: ScheduleSlotSchema },
      { name: 'Doctor', schema: DoctorSchema },
      { name: 'Branch', schema: BranchSchema },
      // Slot cancellation cascades into appointments
      { name: 'Appointment', schema: AppointmentSchema },
    ]),
  ],
  controllers: [ScheduleTemplateController, SlotController],
  providers: [ScheduleService, ScheduleCronService],
  exports: [MongooseModule, ScheduleService],
})
export class ClinicScheduleModule {}
