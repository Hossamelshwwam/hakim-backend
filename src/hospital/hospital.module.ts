// hospital/hospital.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HospitalSchema } from './schema/hospital.schema';
import { HospitalController } from './hospital.controller';
import { HospitalService } from './hospital.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Hospital', schema: HospitalSchema }]),
  ],
  exports: [MongooseModule],
  controllers: [HospitalController],
  providers: [HospitalService],
})
export class HospitalModule {}
