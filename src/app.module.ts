import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { SharedModule } from './common/module/shared.module';
import { TestModule } from './test/test.module';
import { APP_GUARD } from '@nestjs/core';
import { TenantGuard } from './common/guards/tenant.guard';
import { HospitalModule } from './hospital/hospital.module';
import { BranchModule } from './branch/branch.module';
import { ScheduleModule } from '@nestjs/schedule';
import { HospitalApplicationModule } from './hospital-application/hospital-application.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { DepartmentModule } from './department/department.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { ScheduleModule as ClinicScheduleModule } from './schedule/schedule.module';
import { AppointmentModule } from './appointment/appointment.module';
import { PlanModule } from './plan/plan.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
        dbName: config.get<string>('MONGO_DB_NAME'),
      }),
      inject: [ConfigService],
    }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('SMTP_HOST'),
          port: config.get<number>('SMTP_PORT'),
          auth: {
            user: config.get<string>('SMTP_USER'),
            pass: config.get<string>('SMTP_PASS'),
          },
        },
        defaults: {
          from: config.get<string>('EMAIL_FROM'),
        },
        template: {
          adapter: new HandlebarsAdapter(),
        },
      }),
    }),
    SharedModule,
    CloudinaryModule,
    HospitalModule,
    UserModule,
    AuthModule,
    TestModule,
    BranchModule,
    HospitalApplicationModule,
    PlatformAdminModule,
    DepartmentModule,
    DoctorModule,
    PatientModule,
    ClinicScheduleModule,
    AppointmentModule,
    PlanModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: TenantGuard }],
})
export class AppModule {}
