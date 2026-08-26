import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ScheduleTemplateDocument } from './schema/schedule-template.schema';
import { ScheduleSlotDocument } from './schema/schedule-slot.schema';
import type { DoctorDocument } from '../doctor/schema/doctor.schema';
import type { AuthUser } from '../common/types/user.type';
import {
  CreateScheduleTemplateDto,
  ListSlotsQueryDto,
} from './dto/schedule.dto';
import { PaginationService } from '../common/services/pagination.service';
import { PaginationMeta } from '../common/types/pagination.type';

export const BOOKING_HORIZON_DAYS = 56; // 8-week rolling window

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function startOfUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel('ScheduleTemplate')
    private readonly templateModel: Model<ScheduleTemplateDocument>,
    @InjectModel('ScheduleSlot')
    private readonly slotModel: Model<ScheduleSlotDocument>,
    @InjectModel('Doctor') private readonly doctorModel: Model<DoctorDocument>,
    @InjectModel('Branch') private readonly branchModel: Model<any>,
    @InjectModel('Appointment')
    private readonly appointmentModel: Model<any>,
    private readonly paginationService: PaginationService,
  ) {}

  // ── Templates ──────────────────────────────────────────────────────────────

  async createTemplate(
    hospitalId: string,
    requester: AuthUser,
    body: CreateScheduleTemplateDto,
  ) {
    const doctor = await this.resolveManagingDoctor(
      hospitalId,
      requester,
      body.doctorId,
    );

    const branchExists = await this.branchModel.countDocuments({
      _id: new Types.ObjectId(body.branchId),
      hospital_id: new Types.ObjectId(hospitalId),
    });
    if (!branchExists)
      throw new BadRequestException('Branch not found in this hospital');

    const today = startOfTodayUTC();

    // Validate BEFORE creating anything — no orphan templates
    if (body.type === 'custom' && body.date && startOfUTC(body.date) < today)
      throw new BadRequestException('Cannot create slots in the past');

    const template = await this.templateModel.create({
      type: body.type,
      doctor_id: doctor._id,
      branch_id: new Types.ObjectId(body.branchId),
      startTime: body.startTime,
      endTime: body.endTime,
      daysOfWeek: body.type === 'repeated' ? body.daysOfWeek : undefined,
      date: body.type === 'custom' ? body.date : undefined,
      repeatFrom:
        body.type === 'repeated'
          ? (body.repeatFrom ?? addDays(today, 1))
          : undefined,
      capacity: body.capacity,
      hospital_id: new Types.ObjectId(hospitalId),
    });

    let occurrencesCreated = 0;
    if (body.type === 'custom') {
      occurrencesCreated = await this.materializeSingleOccurrence(template);
    } else {
      const horizonEnd = addDays(today, BOOKING_HORIZON_DAYS);
      occurrencesCreated = await this.materializeRange(
        template,
        template.repeatFrom as Date,
        horizonEnd,
      );
      template.horizonUntil = horizonEnd;
      await template.save();
    }

    return { template, occurrencesCreated };
  }

  /**
   * Doctor chooses per occurrence: closing ONE date leaves future Fridays
   * untouched. All booked/confirmed appointments inside become cancelled.
   */
  async closeOccurrence(
    hospitalId: string,
    slotId: string,
    requester: AuthUser,
  ) {
    const slot = await this.findScopedSlot(hospitalId, slotId);
    await this.assertCanManage(hospitalId, requester, String(slot.doctor_id));

    if (slot.status === 'closed') return { slot, cancelledAppointments: 0 };

    slot.status = 'closed';
    await slot.save();

    const result = await this.cancelAppointments([String(slot._id)]);

    return { slot, cancelledAppointments: result.modifiedCount };
  }

  /** Closing the WHOLE series: template off + all FUTURE occurrences closed. */
  async deactivateSeries(
    hospitalId: string,
    templateId: string,
    requester: AuthUser,
  ) {
    const template = await this.templateModel.findOne({
      _id: new Types.ObjectId(templateId),
      hospital_id: new Types.ObjectId(hospitalId),
    });
    if (!template) throw new NotFoundException('Schedule template not found');

    await this.assertCanManage(
      hospitalId,
      requester,
      String(template.doctor_id),
    );

    template.isActive = false;
    await template.save();

    const today = startOfTodayUTC();
    const futureSlots = await this.slotModel
      .find({
        template_id: template._id,
        status: 'open',
        date: { $gte: today },
      })
      .select('_id');
    const slotIds = futureSlots.map((s) => String(s._id));

    if (slotIds.length) {
      await this.slotModel.updateMany(
        { _id: { $in: slotIds } },
        { $set: { status: 'closed' } },
      );
    }
    const result = await this.cancelAppointments(slotIds);

    return {
      template,
      closedSlots: slotIds.length,
      cancelledAppointments: result.modifiedCount,
    };
  }

  // ── Slots (read side) ─────────────────────────────────────────────────────

  async listSlots(
    hospitalId: string,
    query: ListSlotsQueryDto & { page?: number; limit?: number },
  ) {
    const { skip, limit, page } = this.paginationService.getPagination(
      query.page,
      query.limit,
    );

    const today = startOfTodayUTC();
    const filter: Record<string, unknown> = {
      hospital_id: new Types.ObjectId(hospitalId),
      date: {
        $gte: query.from ?? today,
        $lte: query.to ?? addDays(today, 30),
      },
    };
    if (query.doctorId) filter.doctor_id = new Types.ObjectId(query.doctorId);
    if (query.branchId) filter.branch_id = new Types.ObjectId(query.branchId);

    if (query.onlyAvailable) {
      filter.status = 'open';
      // capacity may be undefined (= unlimited) — treat as infinite seats
      filter.$expr = {
        $lt: [
          '$bookedCount',
          { $ifNull: ['$capacity', Number.MAX_SAFE_INTEGER] },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.slotModel
        .find(filter)
        .sort({ date: 1, startTime: 1 })
        .skip(skip)
        .limit(limit),
      this.slotModel.countDocuments(filter),
    ]);

    const pagination: PaginationMeta =
      this.paginationService.buildPaginationMeta(total, page, limit);

    return { items: items.map((s) => this.withAvailability(s)), pagination };
  }

  async getSlot(hospitalId: string, slotId: string) {
    const slot = await this.findScopedSlot(hospitalId, slotId);
    return this.withAvailability(slot);
  }

  // ── Rolling horizon (daily cron) ──────────────────────────────────────────

  /** Keeps every active repeated template materialized 8 weeks ahead. */
  async extendHorizons() {
    const today = startOfTodayUTC();
    const targetEnd = addDays(today, BOOKING_HORIZON_DAYS);

    const templates = await this.templateModel.find({
      isActive: true,
      type: 'repeated',
      $or: [
        { horizonUntil: { $lt: targetEnd } },
        { horizonUntil: { $exists: false } },
        { horizonUntil: null },
      ],
    });

    let created = 0;
    for (const template of templates) {
      const from = template.horizonUntil
        ? addDays(template.horizonUntil, 1)
        : (template.repeatFrom ?? addDays(today, 1));
      created += await this.materializeRange(template, from, targetEnd);
      template.horizonUntil = targetEnd;
      await template.save();
    }

    return { templates: templates.length, created };
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async materializeSingleOccurrence(
    template: ScheduleTemplateDocument,
  ) {
    const res = await this.slotModel.updateOne(
      { template_id: template._id, date: template.date },
      {
        $setOnInsert: this.slotSeed(template, template.date as Date),
      },
      { upsert: true },
    );
    return res.upsertedCount ?? 0;
  }

  /** Idempotent occurrence generation — safe to overlap with the cron. */
  private async materializeRange(
    template: ScheduleTemplateDocument,
    from: Date,
    to: Date,
  ) {
    const rangeStart = startOfTodayUTC() > from ? startOfTodayUTC() : from;
    let created = 0;

    for (let day = new Date(rangeStart); day <= to; day = addDays(day, 1)) {
      if (!template.daysOfWeek?.includes(day.getUTCDay())) continue;

      const res = await this.slotModel.updateOne(
        { template_id: template._id, date: new Date(day) },
        { $setOnInsert: this.slotSeed(template, new Date(day)) },
        { upsert: true },
      );
      created += res.upsertedCount ?? 0;
    }
    return created;
  }

  private slotSeed(template: ScheduleTemplateDocument, date: Date) {
    return {
      template_id: template._id,
      doctor_id: template.doctor_id,
      branch_id: template.branch_id,
      date: new Date(date),
      startTime: template.startTime,
      endTime: template.endTime,
      capacity: template.capacity,
      bookedCount: 0,
      status: 'open',
      hospital_id: template.hospital_id,
    };
  }

  private async cancelAppointments(slotIds: string[]) {
    if (!slotIds.length) return { modifiedCount: 0 };

    return this.appointmentModel.updateMany(
      {
        schedule_id: { $in: slotIds.map((id) => new Types.ObjectId(id)) },
        status: { $in: ['booked', 'confirmed'] },
      },
      { $set: { status: 'cancelled' } },
    );
  }

  private findScopedSlot(hospitalId: string, slotId: string) {
    return this.slotModel
      .findOne({
        _id: new Types.ObjectId(slotId),
        hospital_id: new Types.ObjectId(hospitalId),
      })
      .then((slot) => {
        if (!slot) throw new NotFoundException('Slot not found');
        return slot;
      });
  }

  /**
   * Managers manage everything in their hospital; doctors only their own
   * slots (verified through their Doctor profile, not the raw token).
   */
  private async assertCanManage(
    hospitalId: string,
    requester: AuthUser,
    ownerDoctorId: string,
  ) {
    if (requester.role === 'hospital_manager') return;
    if (requester.role !== 'doctor') throw new ForbiddenException();

    const profile = await this.doctorModel.findOne({
      user_id: new Types.ObjectId(requester.userId),
      hospital_id: new Types.ObjectId(hospitalId),
    });
    if (!profile || String(profile._id) !== ownerDoctorId)
      throw new ForbiddenException('You can only manage your own schedule');
  }

  private async resolveManagingDoctor(
    hospitalId: string,
    requester: AuthUser,
    doctorId?: string,
  ) {
    if (requester.role === 'doctor') {
      const profile = await this.doctorModel.findOne({
        user_id: new Types.ObjectId(requester.userId),
        hospital_id: new Types.ObjectId(hospitalId),
      });
      if (!profile) throw new ForbiddenException('Doctor profile not found');
      return profile;
    }

    if (!doctorId) throw new BadRequestException('doctorId is required');
    const profile = await this.doctorModel.findOne({
      _id: new Types.ObjectId(doctorId),
      hospital_id: new Types.ObjectId(hospitalId),
    });
    if (!profile)
      throw new BadRequestException('Doctor not found in this hospital');
    return profile;
  }

  private withAvailability(slot: ScheduleSlotDocument) {
    const obj = slot.toObject() as unknown as Record<string, unknown>;
    const remaining =
      typeof obj.capacity === 'number'
        ? Math.max(0, obj.capacity - (obj.bookedCount as number))
        : null; // null = unlimited
    return { ...obj, seatsLeft: remaining };
  }
}
