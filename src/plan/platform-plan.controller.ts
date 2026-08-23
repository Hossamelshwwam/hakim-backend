import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlanService } from './plan.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { SkipTenant } from '../common/decorator/skip-tenant.decorator';
import { PlatformAuthGuard } from '../platform-admin/guards/platform-auth.guard';

@ApiTags('Platform Admin — Plans')
@ApiBearerAuth()
@SkipTenant()
@UseGuards(PlatformAuthGuard)
@Controller('platform-admin/plans')
export class PlatformPlanController {
  constructor(private readonly planService: PlanService) {}

  @Post()
  async create(@Body() body: CreatePlanDto) {
    const data = await this.planService.create(body);
    return {
      success: true,
      statusCode: 201,
      data,
      message: 'Plan created successfully',
    };
  }

  // Admin listing can include inactive plans
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

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdatePlanDto) {
    const data = await this.planService.update(id, body);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Plan updated successfully',
    };
  }
}
