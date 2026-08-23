import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../types/user.type';

/**
 * Runs AFTER AuthGuard (route guard order) so req.user is populated, and
 * AFTER the global TenantGuard has resolved req.hospitalId from the
 * x-tenant-slug header / subdomain.
 *
 * Enforces that an authenticated account can only act inside the hospital
 * it belongs to — without this, any user could read/write another tenant's
 * data by changing the tenant header.
 *
 * Passes through when either side is absent: public routes (no user),
 * @SkipTenant() routes (no hospitalId), and platform-admin routes.
 */
@Injectable()
export class TenantBindingGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    const hospitalId = req.hospitalId as string | undefined;

    if (!user || !hospitalId) return true;

    if (user.hospitalId !== hospitalId) {
      throw new ForbiddenException(
        'Your account does not belong to this hospital',
      );
    }

    return true;
  }
}
