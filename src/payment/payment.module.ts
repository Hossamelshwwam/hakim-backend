import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentSchema } from './schema/payment.schema';
import { HospitalSchema } from '../hospital/schema/hospital.schema';
import { PlanSchema } from '../plan/schema/plan.schema';
import { PaymentService } from './payment.service';
import { PaymentCronService } from './payment.cron.service';
import { PaymentController } from './payment.controller';
import { PlatformPaymentController } from './platform-payment.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Payment', schema: PaymentSchema },
      { name: 'Hospital', schema: HospitalSchema },
      { name: 'Plan', schema: PlanSchema },
    ]),
  ],
  controllers: [PaymentController, PlatformPaymentController],
  providers: [PaymentService, PaymentCronService],
  exports: [MongooseModule, PaymentService],
})
export class PaymentModule {}
