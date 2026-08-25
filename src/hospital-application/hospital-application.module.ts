import { Module } from '@nestjs/common';
import { HospitalApplicationService } from './hospital-application.service';
import { HospitalApplicationController } from './hospital-application.controller';
import { AuthModule } from '../auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { HospitalApplicationSchema } from './schema/hospital-application.schema';
import { HospitalModule } from '../hospital/hospital.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { UserSchema } from '../user/schema/user.schema';
import { PlanSchema } from '../plan/schema/plan.schema';
import { PaymentModule } from '../payment/payment.module';

@Module({
  providers: [HospitalApplicationService],
  controllers: [HospitalApplicationController],
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: 'HospitalApplication', schema: HospitalApplicationSchema },
      { name: 'User', schema: UserSchema },
      { name: 'Plan', schema: PlanSchema },
    ]),
    HospitalModule,
    CloudinaryModule,
    PlatformAdminModule,
    PaymentModule,
  ],
})
export class HospitalApplicationModule {}
