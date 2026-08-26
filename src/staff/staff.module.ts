import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { UserSchema } from '../user/schema/user.schema';
import { DoctorSchema } from '../doctor/schema/doctor.schema';
import { DepartmentSchema } from '../department/schema/department.schema';
import { BranchSchema } from '../branch/schema/branch.schema';
import { HospitalSchema } from '../hospital/schema/hospital.schema';
import { ScheduleSlotSchema } from '../schedule/schema/schedule-slot.schema';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Doctor', schema: DoctorSchema },
      { name: 'Department', schema: DepartmentSchema },
      { name: 'Branch', schema: BranchSchema },
      { name: 'Hospital', schema: HospitalSchema },
      { name: 'ScheduleSlot', schema: ScheduleSlotSchema },
    ]),
  ],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
