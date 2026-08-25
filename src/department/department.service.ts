import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DepartmentDocument } from './schema/department.schema';
import {
  CreateDepartmentDto,
  ListDepartmentsQueryDto,
  UpdateDepartmentDto,
} from './dto/department.dto';
import { PaginationService } from '../common/services/pagination.service';
import { PaginationMeta } from '../common/types/pagination.type';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class DepartmentService {
  constructor(
    @InjectModel('Department')
    private readonly departmentModel: Model<DepartmentDocument>,
    private readonly paginationService: PaginationService,
  ) {}

  async create(hospitalId: string, body: CreateDepartmentDto) {
    await this.ensureNameFree(hospitalId, body.name);

    return this.departmentModel.create({
      name: body.name,
      hospital_id: new Types.ObjectId(hospitalId),
    });
  }

  async findAll(
    hospitalId: string,
    query: ListDepartmentsQueryDto & { page?: number; limit?: number },
  ) {
    const { skip, limit, page } = this.paginationService.getPagination(
      query.page,
      query.limit,
    );

    const filter: Record<string, unknown> = {
      hospital_id: new Types.ObjectId(hospitalId),
    };
    if (query.status) filter.isActive = query.status === 'active';
    if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i');

    const [items, total] = await Promise.all([
      this.departmentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.departmentModel.countDocuments(filter),
    ]);

    const pagination: PaginationMeta =
      this.paginationService.buildPaginationMeta(total, page, limit);

    return { items, pagination };
  }

  /** Ownership-enforced read — another hospital's department is a 404. */
  async findOne(hospitalId: string, id: string) {
    return this.findScoped(hospitalId, id);
  }

  async update(hospitalId: string, id: string, body: UpdateDepartmentDto) {
    const department = await this.findScoped(hospitalId, id);

    if (body.name && body.name.toLowerCase() !== department.name.toLowerCase())
      await this.ensureNameFree(hospitalId, body.name);

    Object.assign(department, body);
    await department.save();
    return department;
  }

  /** Soft-delete — doctors referencing the department keep their history. */
  async softDelete(hospitalId: string, id: string) {
    const department = await this.findScoped(hospitalId, id);
    department.isActive = false;
    await department.save();
    return department;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private findScoped(hospitalId: string, id: string) {
    return this.departmentModel
      .findOne({
        _id: new Types.ObjectId(id),
        hospital_id: new Types.ObjectId(hospitalId),
      })
      .then((department) => {
        if (!department) throw new NotFoundException('Department not found');
        return department;
      });
  }

  private async ensureNameFree(
    hospitalId: string,
    name: string,
    excludeId?: Types.ObjectId,
  ) {
    const filter: Record<string, unknown> = {
      hospital_id: new Types.ObjectId(hospitalId),
      name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
    };
    if (excludeId) filter._id = { $ne: excludeId };

    const duplicate = await this.departmentModel.findOne(filter);
    if (duplicate)
      throw new ConflictException(
        'A department with this name already exists in this hospital',
      );
  }
}
