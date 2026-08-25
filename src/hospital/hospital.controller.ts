import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Patch,
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
import { HospitalService } from './hospital.service';
import { UpdateHospitalDto } from './dto/hospital.dto';
import { AuthRoles } from '../common/decorator/auth-roles.decorator';
import { CurrentHospital } from '../common/decorator/current-hospital.decorator';
import { multerConfig } from '../cloudinary/multer.config';

@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('hospital')
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  // Manager-only: the response includes subscription + invoice details,
  // which are sensitive and must not be exposed to doctors/patients
  @Get('me')
  @AuthRoles('hospital_manager')
  async getMe(@CurrentHospital() hospitalId: string) {
    const data = await this.hospitalService.getProfile(hospitalId);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Hospital profile fetched successfully',
    };
  }

  @Patch('me')
  @AuthRoles('hospital_manager')
  async updateMe(
    @CurrentHospital() hospitalId: string,
    @Body() body: UpdateHospitalDto,
  ) {
    const data = await this.hospitalService.updateProfile(hospitalId, body);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Hospital profile updated successfully',
    };
  }

  @Patch('me/logo')
  @AuthRoles('hospital_manager')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        logo: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('logo', multerConfig))
  async uploadLogo(
    @CurrentHospital() hospitalId: string,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const data = await this.hospitalService.uploadLogo(hospitalId, file);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Logo uploaded successfully',
    };
  }
}
