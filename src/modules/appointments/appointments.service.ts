import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AppointmentStatus, ClinicRole } from "@prisma/client";
import { PrismaService } from "../../core/database/prisma.service";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";

/** Shared include shape reused across create/update/status calls */
const APPOINTMENT_INCLUDE = {
  patient: {
    select: { id: true, code: true, fullName: true, phone: true },
  },
  doctor: { select: { id: true, fullName: true, email: true } },
} as const;

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: RequestUser,
    filterDoctorId?: string,
    date?: string,
    status?: string,
  ) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");
    // PERF-01: stale cleanup moved to a @Cron() job in AppointmentsScheduler.
    // We no longer run a write operation on every list/read call.

    const selectedDay = date ? new Date(`${date}T00:00:00`) : new Date();
    if (Number.isNaN(selectedDay.getTime())) {
      throw new BadRequestException("Invalid appointment date");
    }
    const startOfDay = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
    );
    const endOfDay = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate() + 1,
    );

    const doctorFilter =
      user.role === ClinicRole.DOCTOR_ADMIN
        ? { doctorId: user.userId }
        : filterDoctorId
          ? { doctorId: filterDoctorId }
          : {};

    return this.prisma.appointment.findMany({
      where: {
        clinicId: user.clinicId,
        startsAt: { gte: startOfDay, lt: endOfDay },
        ...(status &&
        Object.values(AppointmentStatus).includes(status as AppointmentStatus)
          ? { status: status as AppointmentStatus }
          : {}),
        ...doctorFilter,
      },
      include: APPOINTMENT_INCLUDE,
      orderBy: { startsAt: "asc" },
      take: 100,
    });
  }

  async queue(user: RequestUser) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");

    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );

    return this.prisma.appointment.findMany({
      where: {
        clinicId: user.clinicId,
        startsAt: { gte: startOfDay, lt: endOfDay },
        status: {
          in: [AppointmentStatus.IN_QUEUE, AppointmentStatus.IN_PROGRESS],
        },
        ...{ doctorId: user.userId },
      },
      include: {
        patient: {
          select: {
            id: true,
            code: true,
            fullName: true,
            phone: true,
            dateOfBirth: true,
            medicalNotes: user.role !== ClinicRole.RECEPTIONIST,
          },
        },
        doctor: { select: { id: true, fullName: true } },
      },
      orderBy: { startsAt: "asc" },
    });
  }

  async create(clinicId: string, dto: CreateAppointmentDto, actorId: string) {
    await this.ensurePatientInClinic(clinicId, dto.patientId);
    await this.ensureDoctorInClinic(clinicId, dto.doctorId);

    const hasScheduledTime = Boolean(dto.startsAt && dto.endsAt);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = dto.endsAt
      ? new Date(dto.endsAt)
      : new Date(startsAt.getTime() + 60 * 1000);

    if (hasScheduledTime && endsAt <= startsAt) {
      throw new BadRequestException("endsAt must be after startsAt");
    }

    if (hasScheduledTime) {
      await this.ensureNoConflictingAppointment(
        clinicId,
        dto.doctorId,
        startsAt,
        endsAt,
      );
    }

    // DATA-01: Use include directly in create — no second findUniqueOrThrow round-trip
    const appointment = await this.prisma.appointment.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        startsAt,
        endsAt,
        status: AppointmentStatus.IN_QUEUE,
        visitType: dto.visitType ?? "NEW_VISIT",
        notes: dto.notes,
      },
      include: APPOINTMENT_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        actorId,
        action: "APPOINTMENT_CREATED",
        entityType: "Appointment",
        entityId: appointment.id,
        meta: { doctorId: dto.doctorId, patientId: dto.patientId },
      },
    });

    return appointment;
  }

  async update(
    clinicId: string,
    appointmentId: string,
    dto: UpdateAppointmentDto,
    actor: RequestUser,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
    });
    if (!appointment) throw new NotFoundException("Appointment not found");
    await this.normalizeAndEnsureEditableAppointment(appointment);
    if (
      actor.role === ClinicRole.DOCTOR_ADMIN &&
      appointment.doctorId !== actor.userId
    ) {
      throw new ForbiddenException(
        "Cannot update another doctor's appointment",
      );
    }

    const updatedDoctorId = dto.doctorId ?? appointment.doctorId;
    const updatedPatientId = dto.patientId ?? appointment.patientId;
    const updatedStartsAt = dto.startsAt
      ? new Date(dto.startsAt)
      : appointment.startsAt;
    const updatedEndsAt = dto.endsAt
      ? new Date(dto.endsAt)
      : appointment.endsAt;

    if (dto.patientId && dto.patientId !== appointment.patientId) {
      await this.ensurePatientInClinic(clinicId, dto.patientId);
    }
    if (dto.doctorId && dto.doctorId !== appointment.doctorId) {
      await this.ensureDoctorInClinic(clinicId, dto.doctorId);
    }

    // LOGIC-02: Only run conflict check if time-sensitive fields actually changed
    const timeOrDoctorChanged = dto.doctorId || dto.startsAt || dto.endsAt;
    if (timeOrDoctorChanged) {
      await this.ensureNoConflictingAppointment(
        clinicId,
        updatedDoctorId,
        updatedStartsAt,
        updatedEndsAt,
        appointmentId,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        patientId: updatedPatientId,
        doctorId: updatedDoctorId,
        startsAt: updatedStartsAt,
        endsAt: updatedEndsAt,
        visitType: dto.visitType ?? appointment.visitType,
        notes: dto.notes ?? appointment.notes,
      },
      include: {
        patient: {
          select: { id: true, code: true, fullName: true, phone: true },
        },
        doctor: { select: { id: true, fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        actorId: actor.userId,
        action: "APPOINTMENT_UPDATED",
        entityType: "Appointment",
        entityId: appointmentId,
        meta: {
          patientId: updatedPatientId,
          doctorId: updatedDoctorId,
          startsAt: updatedStartsAt.toISOString(),
          endsAt: updatedEndsAt.toISOString(),
        },
      },
    });

    return updated;
  }

  async delete(clinicId: string, appointmentId: string, actorId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
    });
    if (!appointment) throw new NotFoundException("Appointment not found");
    await this.normalizeAndEnsureEditableAppointment(appointment);

    const deleted = await this.prisma.appointment.delete({
      where: { id: appointmentId },
      include: {
        patient: { select: { id: true, code: true, fullName: true } },
        doctor: { select: { id: true, fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        actorId,
        action: "APPOINTMENT_DELETED",
        entityType: "Appointment",
        entityId: appointmentId,
        meta: {
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
        },
      },
    });

    return deleted;
  }

  private async ensureNoConflictingAppointment(
    clinicId: string,
    doctorId: string,
    startsAt: Date,
    endsAt: Date,
    excludeAppointmentId?: string,
  ) {
    const existing = await this.prisma.appointment.findFirst({
      where: {
        clinicId,
        doctorId,
        status: { not: AppointmentStatus.CANCELLED },
        AND: [{ startsAt: { lt: endsAt } }, { endsAt: { gt: startsAt } }],
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException("Time slot already booked for this doctor");
    }
  }

  async updateStatus(
    clinicId: string,
    appointmentId: string,
    status: AppointmentStatus,
    actor: RequestUser,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
    });
    if (!appointment) throw new NotFoundException("Appointment not found");
    await this.normalizeAndEnsureEditableAppointment(appointment);
    if (
      actor.role === ClinicRole.DOCTOR_ADMIN &&
      appointment.doctorId !== actor.userId
    ) {
      throw new ForbiddenException(
        "Cannot update another doctor's appointment",
      );
    }

    const VALID_TRANSITIONS: Partial<
      Record<AppointmentStatus, AppointmentStatus[]>
    > = {
      IN_QUEUE: [AppointmentStatus.IN_PROGRESS, AppointmentStatus.CANCELLED],
      IN_PROGRESS: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
    };
    const allowed = VALID_TRANSITIONS[appointment.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${appointment.status} to ${status}`,
      );
    }

    // DATA-02: Removed the duplicate if(IN_PROGRESS→COMPLETED) branch.
    // All status transitions use the same single update + audit log path.
    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status },
      include: {
        patient: { select: { id: true, code: true, fullName: true } },
        doctor: { select: { id: true, fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        actorId: actor.userId,
        action: "APPOINTMENT_STATUS_UPDATED",
        entityType: "Appointment",
        entityId: appointmentId,
        meta: { status },
      },
    });

    return updated;
  }

  private async ensurePatientInClinic(clinicId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, clinicId },
    });
    if (!patient)
      throw new NotFoundException("Patient not found in this clinic");
  }

  private async ensureDoctorInClinic(clinicId: string, doctorId: string) {
    const doctor = await this.prisma.clinicUser.findFirst({
      where: {
        clinicId,
        userId: doctorId,
        role: { in: [ClinicRole.DOCTOR_ADMIN] },
        isActive: true,
      },
    });
    if (!doctor) throw new NotFoundException("Doctor not found in this clinic");
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // PERF-01: This method is called from a @Cron() scheduler (appointments.scheduler.ts)
  // instead of on every read/list call. Kept public for the scheduler.
  async cancelStaleWaitingAppointments(clinicId?: string) {
    await this.prisma.appointment.updateMany({
      where: {
        ...(clinicId ? { clinicId } : {}),
        startsAt: { lt: this.startOfToday() },
        status: AppointmentStatus.IN_QUEUE,
      },
      data: { status: AppointmentStatus.CANCELLED },
    });
  }

  private async normalizeAndEnsureEditableAppointment(appointment: {
    id: string;
    startsAt: Date;
    status: AppointmentStatus;
  }) {
    if (appointment.startsAt < this.startOfToday()) {
      const staleWaitingStatuses: AppointmentStatus[] = [
        AppointmentStatus.IN_QUEUE,
      ];
      if (staleWaitingStatuses.includes(appointment.status)) {
        await this.prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: AppointmentStatus.CANCELLED },
        });
      }
      throw new BadRequestException("Past-day appointments cannot be changed");
    }
  }
}
