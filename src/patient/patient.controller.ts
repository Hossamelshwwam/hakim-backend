import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PatientService } from './patient.service';
import {
  CreateWalkInPatientDto,
  ListPatientsQueryDto,
} from './dto/patient.dto';
import { AuthRoles } from '../common/decorator/auth-roles.decorator';
import { CurrentHospital } from '../common/decorator/current-hospital.decorator';

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  // Walk-in registration — account is created immediately (claimable later
  // from the website via phone matching) and bookable right away
  @Post()
  @AuthRoles('hospital_manager', 'receptionist')
  async registerWalkIn(
    @CurrentHospital() hospitalId: string,
    @Body() body: CreateWalkInPatientDto,
  ) {
    const data = await this.patientService.registerWalkIn(hospitalId, body);
    return {
      success: true,
      statusCode: 201,
      data,
      message:
        'Patient registered. They can book appointments now and claim their account from the website later.',
    };
  }

  @Get()
  @AuthRoles('hospital_manager', 'receptionist', 'nurse')
  async findAll(
    @CurrentHospital() hospitalId: string,
    @Query() query: ListPatientsQueryDto,
  ) {
    const data = await this.patientService.findAll(hospitalId, query);
    return {
      success: true,
      statusCode: 200,
      ...data,
      message: 'Patients fetched successfully',
    };
  }
}
