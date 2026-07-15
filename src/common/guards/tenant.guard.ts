// common/guards/tenant.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SKIP_TENANT_KEY } from '../decorator/skip-tenant.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel('Hospital') private hospitalModel: Model<any>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest();
    const headerSlug = req.headers['x-tenant-slug'] as string | undefined;
    const slug = headerSlug || req.hostname.split('.')[0];

    if (!slug) throw new NotFoundException('Hospital could not be resolved');

    const hospital = await this.hospitalModel.findOne({
      slug,
      status: 'active',
    });
    if (!hospital) throw new NotFoundException('Hospital not found');

    req.hospitalId = hospital._id.toString();
    return true;
  }
}
