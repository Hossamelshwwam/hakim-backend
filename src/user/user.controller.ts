import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  HttpException,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  ChangePasswordDto,
  GetAllAdminsQueryDto,
  UpdateAdminDto,
  UpdateProfileDto,
} from './dto/user-dto';
import { ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { AuthRoles } from '../common/decorator/auth-roles.decorator';
import type { AuthUser } from '../common/types/user.type';
import { CurrentUser } from '../common/decorator/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../cloudinary/multer.config';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @AuthRoles()
  @Patch('me/avatar')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('avatar', multerConfig))
  async uploadCategoryImage(
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
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    const data = await this.userService.uploadUserImage(user.userId, file);
    return { data, message: 'Image uploaded', success: true };
  }

  @ApiBearerAuth()
  @AuthRoles()
  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    const data = await this.userService.getMyProfile(user.userId);
    return {
      success: true,
      data,
      message: 'User profile fetched successfully',
    };
  }

  @ApiBearerAuth()
  @Put('me')
  @AuthRoles()
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateProfileDto,
  ) {
    const data = await this.userService.updateMyProfile(user.userId, body);
    return {
      success: true,
      data,
      message: 'User profile updated successfully',
    };
  }

  @ApiBearerAuth()
  @Patch('me/change-password')
  @AuthRoles()
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordDto,
  ) {
    const data = await this.userService.changePassword(user.userId, body);
    return {
      success: true,
      data,
      message: 'Password changed successfully',
    };
  }

  @ApiBearerAuth()
  @Get('admin')
  async getAllAdmin(@Query() query: GetAllAdminsQueryDto) {
    const data = await this.userService.getAllAdmins(query);
    return {
      success: true,
      data: data.users,
      message: 'Admins fetched successfully',
      pagination: data.pagination,
    };
  }

  @ApiBearerAuth()
  @Get('admin/:id')
  async getAdmin(@Param('id') id: string) {
    const data = await this.userService.getAdmin(id);
    return {
      success: true,
      data,
      message: 'User fetched successfully',
    };
  }

  @ApiBearerAuth()
  @Patch('admin/:id')
  async updateAdmin(@Param('id') id: string, @Body() body: UpdateAdminDto) {
    const data = await this.userService.updateAdmin(id, body);
    return {
      success: true,
      data,
      message: 'Admin fetched successfully',
    };
  }
}
