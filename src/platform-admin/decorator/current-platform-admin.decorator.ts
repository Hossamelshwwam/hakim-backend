// platform-admin/decorator/current-platform-admin.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentPlatformAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().user; // { adminId }
  },
);
