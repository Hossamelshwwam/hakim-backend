import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiSecurity,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaymentService } from './payment.service';
import { proofMulterConfig } from './multer-proof.config';
import { AuthRoles } from '../common/decorator/auth-roles.decorator';
import { CurrentHospital } from '../common/decorator/current-hospital.decorator';

@ApiBearerAuth()
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // Hospital manager: full financial history of their hospital.
  // TenantGuard resolves req.hospitalId from the tenant header/subdomain.
  @ApiSecurity('tenant-slug')
  @Get()
  @AuthRoles('hospital_manager')
  async findAll(
    @CurrentHospital() hospitalId: string,
    @Query()
    query: {
      status?: 'pending' | 'approved' | 'rejected' | 'overdue';
      page?: number;
      limit?: number;
    },
  ) {
    const data = await this.paymentService.findForHospital(hospitalId, query);
    return {
      success: true,
      statusCode: 200,
      ...data,
      message: 'Payments fetched successfully',
    };
  }

  @Get('upcoming')
  @ApiSecurity('tenant-slug')
  @AuthRoles('hospital_manager')
  async upcoming(@CurrentHospital() hospitalId: string) {
    const data = await this.paymentService.getUpcoming(hospitalId);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Upcoming payments fetched successfully',
    };
  }

  @Post(':id/proof')
  @AuthRoles('hospital_manager')
  @ApiSecurity('tenant-slug')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        proof: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('proof', proofMulterConfig))
  async uploadProof(
    @Param('id') id: string,
    @CurrentHospital() hospitalId: string,
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
    const data = await this.paymentService.uploadProof(hospitalId, id, file);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Payment proof uploaded. Pending platform review.',
    };
  }
}
