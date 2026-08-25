import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DepartmentService } from './department.service';
import {
  CreateDepartmentDto,
  ListDepartmentsQueryDto,
  UpdateDepartmentDto,
} from './dto/department.dto';
import { AuthRoles } from '../common/decorator/auth-roles.decorator';
import { CurrentHospital } from '../common/decorator/current-hospital.decorator';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  @AuthRoles('hospital_manager')
  async create(
    @CurrentHospital() hospitalId: string,
    @Body() body: CreateDepartmentDto,
  ) {
    const data = await this.departmentService.create(hospitalId, body);
    return {
      success: true,
      statusCode: 201,
      data,
      message: 'Department created successfully',
    };
  }

  @Get()
  @AuthRoles()
  async findAll(
    @CurrentHospital() hospitalId: string,
    @Query() query: ListDepartmentsQueryDto,
  ) {
    const data = await this.departmentService.findAll(hospitalId, query);
    return {
      success: true,
      statusCode: 200,
      ...data,
      message: 'Departments fetched successfully',
    };
  }

  @Get(':id')
  @AuthRoles()
  async findOne(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
  ) {
    const data = await this.departmentService.findOne(hospitalId, id);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Department fetched successfully',
    };
  }

  @Patch(':id')
  @AuthRoles('hospital_manager')
  async update(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
    @Body() body: UpdateDepartmentDto,
  ) {
    const data = await this.departmentService.update(hospitalId, id, body);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Department updated successfully',
    };
  }

  // Soft-delete — the department becomes inactive, never erased
  @Delete(':id')
  @AuthRoles('hospital_manager')
  async remove(@CurrentHospital() hospitalId: string, @Param('id') id: string) {
    const data = await this.departmentService.softDelete(hospitalId, id);
    return {
      success: true,
      statusCode: 200,
      data,
      message: 'Department deactivated successfully',
    };
  }
}
