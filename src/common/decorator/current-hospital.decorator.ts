// common/decorator/current-hospital.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentHospital = createParamDecorator(
  (_, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().hospitalId;
  },
);
