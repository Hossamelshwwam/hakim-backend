// platform-admin/guards/platform-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PlatformAuthGuard extends AuthGuard('platform-jwt') {}
