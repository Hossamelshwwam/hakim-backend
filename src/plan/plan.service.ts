import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PlanDocument } from './schema/plan.schema';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@Injectable()
export class PlanService {
  constructor(
    @InjectModel('Plan') private readonly planModel: Model<PlanDocument>,
  ) {}

  async create(body: CreatePlanDto) {
    const existing = await this.planModel.findOne({ slug: body.slug });
    if (existing) throw new ConflictException('Plan slug already exists');

    return this.planModel.create(body);
  }

  async findAll(includeInactive = false) {
    const filter = includeInactive ? {} : { isActive: true };
    return this.planModel
      .find(filter)
      .sort({ monthlyPrice: 1 })
      .collation({ locale: 'en', numericOrdering: true });
  }

  async findBySlug(slug: string) {
    return this.planModel.findOne({ slug, isActive: true });
  }

  async update(id: string, body: UpdatePlanDto) {
    const plan = await this.planModel.findById(id);
    if (!plan) throw new NotFoundException('Plan not found');

    if (body.slug && body.slug !== plan.slug) {
      const existing = await this.planModel.findOne({ slug: body.slug });
      if (existing) throw new ConflictException('Plan slug already exists');
    }

    Object.assign(plan, body);
    await plan.save();
    return plan;
  }
}
