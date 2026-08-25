// hospital-application/hospital-application.controller.ts
import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { HospitalApplicationService } from './hospital-application.service';
import {
  ApplyDto,
  ListApplicationsQueryDto,
  RejectApplicationDto,
} from './dto/hospital-application.dto';
import { SkipTenant } from '../common/decorator/skip-tenant.decorator';
import { multerConfig } from '../cloudinary/multer.config';
import { PlatformAuthGuard } from '../platform-admin/guards/platform-auth.guard';
import { CurrentPlatformAdmin } from '../platform-admin/decorator/current-platform-admin.decorator';

@SkipTenant()
@Controller('hospital-applications')
export class HospitalApplicationController {
  constructor(
    private readonly applicationService: HospitalApplicationService,
  ) {}

  // ── Public: anyone applying to rent a hospital tenant ──────────────────────
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        hospitalName: { type: 'string' },
        slug: { type: 'string' },
        ownerName: { type: 'string' },
        ownerEmail: { type: 'string' },
        ownerPhone: { type: 'string' },
        plan: { type: 'string' },
        billingCycle: {
          type: 'string',
          enum: ['monthly', 'yearly'],
          default: 'monthly',
        },
        paymentProof: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('paymentProof', multerConfig))
  async apply(
    @Body() body: ApplyDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /image\/(jpeg|png|webp)|application\/pdf/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const data = await this.applicationService.apply(body, file);
    return {
      success: true,
      statusCode: 201,
      data,
      message:
        'Application submitted. We will review it and get back to you soon.',
    };
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(PlatformAuthGuard)
  async findAll(@Query() query: ListApplicationsQueryDto) {
    const data = await this.applicationService.findAll(query);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Applications fetched successfully',
    };
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(PlatformAuthGuard)
  async findOne(@Param('id') id: string) {
    const data = await this.applicationService.findById(id);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Application fetched successfully',
    };
  }

  @Patch(':id/approve')
  @ApiBearerAuth()
  @UseGuards(PlatformAuthGuard)
  async approve(
    @Param('id') id: string,
    @CurrentPlatformAdmin() admin: { adminId: string },
  ) {
    const data = await this.applicationService.approve(id, admin.adminId);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Application approved',
    };
  }

  @Patch(':id/reject')
  @ApiBearerAuth()
  @UseGuards(PlatformAuthGuard)
  async reject(
    @Param('id') id: string,
    @Body() body: RejectApplicationDto,
    @CurrentPlatformAdmin() admin: { adminId: string },
  ) {
    const data = await this.applicationService.reject(id, admin.adminId, body);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Application rejected',
    };
  }
}
