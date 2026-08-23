import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { TenantBindingGuard } from '../guards/tenant-binding.guard';

export const AuthRoles = (...roles: string[]) =>
  applyDecorators(
    SetMetadata('roles', roles),
    UseGuards(AuthGuard, RolesGuard, TenantBindingGuard),
  );
