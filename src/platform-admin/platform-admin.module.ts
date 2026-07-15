// platform-admin/platform-admin.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PlatformAdminSchema } from './schema/platform-admin.schema';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformJwtMethodsService } from './services/platform-jwt-methods.service';
import { PlatformJwtStrategy } from './strategies/platform-jwt.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'PlatformAdmin', schema: PlatformAdminSchema },
    ]),
    PassportModule,
    JwtModule,
  ],
  controllers: [PlatformAdminController],
  providers: [
    PlatformAdminService,
    PlatformJwtMethodsService,
    PlatformJwtStrategy,
  ],
  exports: [MongooseModule],
})
export class PlatformAdminModule {}
