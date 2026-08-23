import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlanSchema } from './schema/plan.schema';
import { PlanService } from './plan.service';
import { PlanController } from './plan.controller';
import { PlatformPlanController } from './platform-plan.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Plan', schema: PlanSchema }])],
  controllers: [PlanController, PlatformPlanController],
  providers: [PlanService],
  exports: [MongooseModule],
})
export class PlanModule {}
