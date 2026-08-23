import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlanService } from './plan.service';
import { SkipTenant } from '../common/decorator/skip-tenant.decorator';

@ApiTags('Plans')
@SkipTenant()
@Controller('plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  // Public: pricing page + application form need the active plans
  @Get()
  async findAll(@Query('includeInactive') includeInactive?: string) {
    const data = await this.planService.findAll(includeInactive === 'true');
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Plans fetched successfully',
    };
  }
}
