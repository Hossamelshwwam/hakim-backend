// hospital/hospital.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HospitalSchema } from './schema/hospital.schema';
import { PaymentSchema } from '../payment/schema/payment.schema';
import { HospitalController } from './hospital.controller';
import { PlatformHospitalController } from './platform-hospital.controller';
import { HospitalService } from './hospital.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Hospital', schema: HospitalSchema },
      // Subscription snapshot in the profile reads invoices directly
      { name: 'Payment', schema: PaymentSchema },
    ]),
  ],
  exports: [MongooseModule],
  controllers: [HospitalController, PlatformHospitalController],
  providers: [HospitalService],
})
export class HospitalModule {}
