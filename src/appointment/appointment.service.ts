import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AppointmentDocument } from './schema/appointment.schema';
import type { ScheduleSlotDocument } from '../schedule/schema/schedule-slot.schema';
import type { DoctorDocument } from '../doctor/schema/doctor.schema';
import type { AuthUser } from '../common/types/user.type';
import {
  BookForWalkInDto,
  BookOnlineDto,
  ConfirmAppointmentDto,
  QueueQueryDto,
} from './dto/appointment.dto';
import { PaginationService } from '../common/services/pagination.service';

const MAX_SEATS = Number.MAX_SAFE_INTEGER;
function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

@Injectable()
export class AppointmentService {
  constructor(
    @InjectModel('Appointment')
    private readonly appointmentModel: Model<AppointmentDocument>,
    @InjectModel('ScheduleSlot')
    private readonly slotModel: Model<ScheduleSlotDocument>,
    @InjectModel('Doctor') private readonly doctorModel: Model<DoctorDocument>,
    @InjectModel('Patient') private readonly patientModel: Model<any>,
    @InjectModel('Hospital') private readonly hospitalModel: Model<any>,
    private readonly paginationService: PaginationService,
  ) {}

  // ── Booking ────────────────────────────────────────────────────────────────

  /** Reception / manager books a walk-in or registered patient into a slot. */
  async bookForWalkIn(
    hospitalId: string,
    requester: AuthUser,
    body: BookForWalkInDto,
  ) {
    const patientProfile = await this.patientModel.findOne({
      _id: new Types.ObjectId(body.patientId),
      hospital_id: new Types.ObjectId(hospitalId),
    });
    if (!patientProfile)
      throw new NotFoundException('Patient not found in this hospital');

    return this.book(hospitalId, requester, {
      slotId: body.slotId,
      patientId: String(patientProfile._id),
      bookedVia: 'reception',
      notes: body.notes,
    });
  }

  /** Logged-in patient books themselves into an open future slot. */
  async bookOnline(
    hospitalId: string,
    requester: AuthUser,
    body: BookOnlineDto,
  ) {
    const patientProfile = await this.patientModel.findOne({
      user_id: new Types.ObjectId(requester.userId),
      hospital_id: new Types.ObjectId(hospitalId),
    });
    if (!patientProfile)
      throw new BadRequestException(
        'Your account has no patient profile in this hospital yet',
      );

    return this.book(hospitalId, requester, {
      slotId: body.slotId,
      patientId: String(patientProfile._id),
      bookedVia: 'online',
      notes: body.notes,
    });
  }

  private async book(
    hospitalId: string,
    requester: AuthUser,
    input: {
      slotId: string;
      patientId: string;
      bookedVia: 'reception' | 'online';
      notes?: string;
    },
  ) {
    const now = new Date();
    const today = startOfTodayUTC();
    const currentHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Atomic seat claim — full slots / closed slots lose the race here
    const slot = await this.slotModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(input.slotId),
        hospital_id: new Types.ObjectId(hospitalId),
        status: 'open',
        $or: [
          { date: { $gt: today } },
          { date: today, endTime: { $gt: currentHHmm } },
        ],
        $expr: {
          $lt: ['$bookedCount', { $ifNull: ['$capacity', MAX_SEATS] }],
        },
      },
      { $inc: { bookedCount: 1 } },
      { new: true },
    );
    if (!slot)
      throw new ConflictException(
        'This slot is no longer available (full, closed, or in the past)',
      );

    try {
      return await this.appointmentModel.create({
        patient_id: new Types.ObjectId(input.patientId),
        doctor_id: slot.doctor_id,
        branch_id: slot.branch_id,
        schedule_id: slot._id,
        hospital_id: new Types.ObjectId(hospitalId),
        status: 'booked',
        bookedVia: input.bookedVia,
        createdBy: new Types.ObjectId(requester.userId),
        notes: input.notes,
      });
    } catch (err) {
      // release the seat if the booking itself failed (e.g. duplicate active
      // booking for the same slot — unique partial index)
      await this.slotModel.updateOne(
        { _id: slot._id },
        { $inc: { bookedCount: -1 } },
      );
      if ((err as { code?: number }).code === 11000)
        throw new ConflictException(
          'This patient already holds an active booking in this slot',
        );
      throw err;
    }
  }

  // ── Cancellation ───────────────────────────────────────────────────────────

  async cancel(hospitalId: string, id: string, requester: AuthUser) {
    const appointment = await this.findScoped(hospitalId, id);

    // Completed visits are history — nobody may cancel them afterwards
    if (['completed', 'cancelled'].includes(appointment.status))
      throw new BadRequestException(
        `Cannot cancel a ${appointment.status} appointment`,
      );

    if (requester.role === 'patient') {
      const profile = await this.patientModel.findOne({
        user_id: new Types.ObjectId(requester.userId),
        hospital_id: new Types.ObjectId(hospitalId),
      });
      if (!profile || String(appointment.patient_id) !== String(profile._id))
        throw new ForbiddenException(
          'You can only cancel your own appointments',
        );
    }

    appointment.status = 'cancelled';
    appointment.cancelledBy = new Types.ObjectId(requester.userId);
    appointment.cancelledAt = new Date();
    await appointment.save();

    // free the seat
    await this.slotModel.updateOne(
      { _id: appointment.schedule_id },
      { $inc: { bookedCount: -1 } },
    );

    return appointment;
  }

  // ── Reception confirmation + fee collection ───────────────────────────────

  /**
   * THE queue-order moment: the receptionist confirms arrival and collects
   * the examination fee. Who collected + when is stamped for audit.
   */
  async confirmAndCollect(
    hospitalId: string,
    id: string,
    requester: AuthUser,
    body: ConfirmAppointmentDto,
  ) {
    const appointment = await this.findScoped(hospitalId, id);

    if (appointment.status !== 'booked')
      throw new BadRequestException(
        `Only booked appointments can be confirmed (current: ${appointment.status})`,
      );

    const doctor = await this.doctorModel.findById(appointment.doctor_id);
    const amount = body.amount ?? doctor?.examinationFee;
    if (amount === undefined || amount === null)
      throw new BadRequestException(
        'No examination fee configured for this doctor — provide an amount',
      );

    const updated = await this.appointmentModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        hospital_id: new Types.ObjectId(hospitalId),
        status: 'booked',
      },
      {
        $set: {
          status: 'confirmed',
          feeAmount: amount,
          collectedBy: new Types.ObjectId(requester.userId),
          collectedAt: new Date(),
          confirmedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!updated) {
      throw new ConflictException(
        'Appointment was already confirmed or is no longer booked.',
      );
    }

    return updated;
  }

  // ── Live department queue ─────────────────────────────────────────────────

  /**
   * Confirmed-first FIFO by confirmation time. Each row carries its position
   * and how many patients are still ahead.
   */
  async getQueue(hospitalId: string, query: QueueQueryDto) {
    const dayStart = startOfUTC(query.date ?? new Date());
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const slots = await this.slotModel.find({
      hospital_id: new Types.ObjectId(hospitalId),
      date: { $gte: dayStart, $lt: dayEnd },
      ...(query.doctorId
        ? { doctor_id: new Types.ObjectId(query.doctorId) }
        : {}),
    });
    const slotIds = slots.map((s) => s._id);
    if (!slotIds.length) return { date: dayStart, items: [] };

    let doctorFilter: Record<string, unknown> = {};
    if (query.departmentId || query.doctorId) {
      const doctorFilterById: Record<string, unknown> = {};
      if (query.doctorId)
        doctorFilterById._id = new Types.ObjectId(query.doctorId);
      if (query.departmentId)
        doctorFilterById.department_id = new Types.ObjectId(query.departmentId);
      const doctors = await this.doctorModel.find(doctorFilterById);
      doctorFilter = {
        doctor_id: { $in: doctors.map((d) => d._id) },
      };
    }

    const appointments = await this.appointmentModel
      .find({
        hospital_id: new Types.ObjectId(hospitalId),
        schedule_id: { $in: slotIds },
        status: { $in: ['confirmed', 'in_consultation'] },
        ...doctorFilter,
      })
      .sort({ confirmedAt: 1, _id: 1 })
      .populate({
        path: 'patient_id',
        select: 'user_id',
        populate: { path: 'user_id', select: 'name phone' },
      })
      .populate({
        path: 'doctor_id',
        select: 'user_id department_id examinationFee',
        populate: { path: 'user_id', select: 'name' },
      })
      .populate({ path: 'schedule_id', select: 'date startTime endTime' });

    const items = appointments.map((appt, index) => ({
      ...(appt.toObject() as unknown as Record<string, unknown>),
      position: index + 1,
      peopleAhead: index,
    }));

    return { date: dayStart, items };
  }

  // ── Nurse actions ──────────────────────────────────────────────────────────

  /** Nurse marks who may physically enter now — stamps WHO marked it. */
  async markInConsultation(
    hospitalId: string,
    id: string,
    requester: AuthUser,
  ) {
    const appointment = await this.findScoped(hospitalId, id);

    if (appointment.status !== 'confirmed')
      throw new BadRequestException(
        'Only confirmed (paid) appointments can be called in',
      );

    appointment.status = 'in_consultation';
    appointment.calledBy = new Types.ObjectId(requester.userId);
    appointment.calledAt = new Date();
    await appointment.save();

    return appointment;
  }

  async markCompleted(hospitalId: string, id: string, requester: AuthUser) {
    const appointment = await this.findScoped(hospitalId, id);

    if (!['confirmed', 'in_consultation'].includes(appointment.status))
      throw new BadRequestException(
        `Cannot complete a ${appointment.status} appointment`,
      );

    appointment.status = 'completed';
    appointment.calledBy ??= new Types.ObjectId(requester.userId);
    appointment.calledAt ??= new Date();
    await appointment.save();

    return appointment;
  }

  async markNoShow(hospitalId: string, id: string) {
    const appointment = await this.findScoped(hospitalId, id);

    if (!['booked', 'confirmed'].includes(appointment.status))
      throw new BadRequestException(
        `Cannot mark a ${appointment.status} appointment as no-show`,
      );

    appointment.status = 'no_show';
    await appointment.save();

    return appointment;
  }

  // ── Optional doctor attendance confirmation ────────────────────────────────

  async attend(hospitalId: string, id: string, requester: AuthUser) {
    const hospital = await this.hospitalModel
      .findById(hospitalId)
      .select('requireDoctorConfirmation');
    if (!hospital?.requireDoctorConfirmation)
      throw new BadRequestException(
        'Doctor attendance confirmation is disabled for this hospital',
      );

    const profile = await this.doctorModel.findOne({
      user_id: new Types.ObjectId(requester.userId),
      hospital_id: new Types.ObjectId(hospitalId),
    });
    const appointment = await this.findScoped(hospitalId, id);

    if (!profile || String(appointment.doctor_id) !== String(profile._id))
      throw new ForbiddenException('You can only attend your own appointments');
    if (!['confirmed', 'in_consultation'].includes(appointment.status))
      throw new BadRequestException(
        `Cannot confirm attendance on a ${appointment.status} appointment`,
      );

    appointment.attendedBy = profile.user_id;
    appointment.attendedAt = new Date();
    await appointment.save();

    return appointment;
  }

  // ── Listing ─────────────────────────────────────────────────────────────────

  async findAll(
    hospitalId: string,
    requester: AuthUser,
    query: { status?: string; page?: number; limit?: number },
  ) {
    const { skip, limit, page } = this.paginationService.getPagination(
      query.page,
      query.limit,
    );

    const filter: Record<string, unknown> = {
      hospital_id: new Types.ObjectId(hospitalId),
    };

    // Patients only ever see their own bookings
    if (requester.role === 'patient') {
      const profile = await this.patientModel.findOne({
        user_id: new Types.ObjectId(requester.userId),
        hospital_id: new Types.ObjectId(hospitalId),
      });
      filter.patient_id = profile ? profile._id : null;
    }
    if (requester.role === 'doctor') {
      const profile = await this.doctorModel.findOne({
        user_id: new Types.ObjectId(requester.userId),
        hospital_id: new Types.ObjectId(hospitalId),
      });
      filter.doctor_id = profile ? profile._id : null;
    }
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      this.appointmentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'patient_id',
          select: 'user_id',
          populate: { path: 'user_id', select: 'name phone' },
        })
        .populate({
          path: 'doctor_id',
          select: 'user_id',
          populate: { path: 'user_id', select: 'name' },
        }),
      this.appointmentModel.countDocuments(filter),
    ]);

    const pagination = this.paginationService.buildPaginationMeta(
      total,
      page,
      limit,
    );

    return { items, pagination };
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private findScoped(hospitalId: string, id: string) {
    return this.appointmentModel
      .findOne({
        _id: new Types.ObjectId(id),
        hospital_id: new Types.ObjectId(hospitalId),
      })
      .then((appointment) => {
        if (!appointment) throw new NotFoundException('Appointment not found');
        return appointment;
      });
  }
}

function startOfUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
