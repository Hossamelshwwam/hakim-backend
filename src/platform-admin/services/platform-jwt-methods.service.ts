// platform-admin/services/platform-jwt-methods.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class PlatformJwtMethodsService {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  signAccessToken(payload: { sub: string }) {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('PLATFORM_JWT_SECRET'),
      expiresIn: this.configService.get('PLATFORM_JWT_EXPIRES_IN', '2h'),
    });
  }

  verifyAccessToken(token: string) {
    return this.jwtService.verify(token, {
      secret: this.configService.get<string>('PLATFORM_JWT_SECRET'),
    });
  }
}
