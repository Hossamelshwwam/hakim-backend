import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentSchema } from './schema/appointment.schema';
import { ScheduleSlotSchema } from '../schedule/schema/schedule-slot.schema';
import { DoctorSchema } from '../doctor/schema/doctor.schema';
import { PatientSchema } from '../patient/schema/patient.schema';
import { HospitalSchema } from '../hospital/schema/hospital.schema';
import { AppointmentService } from './appointment.service';
import { AppointmentController } from './appointment.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Appointment', schema: AppointmentSchema },
      { name: 'ScheduleSlot', schema: ScheduleSlotSchema },
      { name: 'Doctor', schema: DoctorSchema },
      { name: 'Patient', schema: PatientSchema },
      // Doctor attendance toggle lives on the hospital document
      { name: 'Hospital', schema: HospitalSchema },
    ]),
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService],
})
export class AppointmentModule {}
