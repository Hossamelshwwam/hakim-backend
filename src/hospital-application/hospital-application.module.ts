import { Module } from '@nestjs/common';
import { HospitalApplicationService } from './hospital-application.service';
import { HospitalApplicationController } from './hospital-application.controller';
import { AuthModule } from 'src/auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { HospitalApplicationSchema } from './schema/hospital-application.schema';
import { HospitalModule } from 'src/hospital/hospital.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { PlatformAdminModule } from 'src/platform-admin/platform-admin.module';
import { UserSchema } from 'src/user/schema/user.schema';

@Module({
  providers: [HospitalApplicationService],
  controllers: [HospitalApplicationController],
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: 'HospitalApplication', schema: HospitalApplicationSchema },
      { name: 'User', schema: UserSchema },
    ]),
    HospitalModule,
    CloudinaryModule,
    PlatformAdminModule,
  ],
})
export class HospitalApplicationModule {}
