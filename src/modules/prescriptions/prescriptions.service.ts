import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import { ClinicRole } from "@prisma/client";
import { PrismaService } from "../../core/database/prisma.service";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async listByPatient(user: RequestUser, patientId: string) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");
    if (user.role === ClinicRole.RECEPTIONIST) {
      throw new ForbiddenException(
        "Receptionists cannot access medical prescriptions",
      );
    }

    return this.prisma.prescription.findMany({
      where: { clinicId: user.clinicId, patientId },
      include: { doctor: { select: { id: true, fullName: true } } },
      orderBy: { issuedAt: "desc" },
    });
  }

  async create(user: RequestUser, dto: CreatePrescriptionDto) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");
    if (user.role !== ClinicRole.DOCTOR_ADMIN) {
      throw new ForbiddenException("Doctor access required");
    }

    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, clinicId: user.clinicId },
    });
    if (!patient) throw new NotFoundException("Patient not found");

    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findFirst({
        where: {
          id: dto.appointmentId,
          clinicId: user.clinicId,
          patientId: dto.patientId,
          doctorId: user.userId,
        },
      });
      if (!appointment) throw new NotFoundException("Appointment not found");
    }

    // DATA-04: Create with appointmentId in a single call — no separate $executeRaw update
    const prescription = await this.prisma.prescription.create({
      data: {
        clinicId: user.clinicId,
        patientId: dto.patientId,
        doctorId: user.userId,
        ...(dto.appointmentId ? { appointmentId: dto.appointmentId } : {}),
        diagnosis: dto.diagnosis,
        medications: JSON.parse(
          JSON.stringify({
            medications: dto.medications,
            notes: dto.notes ?? null,
            requestedTests: dto.requestedTests ?? [],
            requestedImaging: dto.requestedImaging ?? [],
          }),
        ),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        actorId: user.userId,
        action: "PRESCRIPTION_CREATED",
        entityType: "Prescription",
        entityId: prescription.id,
        meta: {
          patientId: dto.patientId,
          appointmentId: dto.appointmentId ?? null,
        },
      },
    });

    return prescription;
  }

  private requireDoctorCatalog(user: RequestUser) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");
    if (user.role !== ClinicRole.DOCTOR_ADMIN) {
      throw new ForbiddenException("Doctor access required");
    }
  }

  async listMedicationCatalog(user: RequestUser, q?: string) {
    this.requireDoctorCatalog(user);
    const query = q?.trim();
    const cacheKey = this.catalogCacheKey("med", user.userId, query);
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const result = await (this.prisma as any).medicationCatalog.findMany({
      where: {
        clinicId: user.clinicId,
        doctorId: user.userId,
        isActive: true,
        ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    });
    await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  }

  // CRIT-06: typed dto instead of Record<string, unknown>
  async createMedicationCatalog(
    user: RequestUser,
    dto: {
      name: string;
      dose?: string;
      frequency?: string;
      duration?: string;
      notes?: string;
    },
  ) {
    this.requireDoctorCatalog(user);
    if (!dto.name?.trim()) throw new BadRequestException("name is required");
    const result = await (this.prisma as any).medicationCatalog.create({
      data: {
        clinicId: user.clinicId,
        doctorId: user.userId,
        name: dto.name.trim(),
        dose: dto.dose?.trim() ?? null,
        frequency: dto.frequency?.trim() ?? null,
        duration: dto.duration?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
      },
    });
    await this.invalidateCatalogCache("med", user.userId);
    return result;
  }

  async updateMedicationCatalog(
    user: RequestUser,
    id: string,
    dto: {
      name?: string;
      dose?: string;
      frequency?: string;
      duration?: string;
      notes?: string;
    },
  ) {
    this.requireDoctorCatalog(user);
    // HIGH-04: verify both clinicId AND doctorId — prevents cross-doctor edits
    await (this.prisma as any).medicationCatalog.findFirstOrThrow({
      where: { id, clinicId: user.clinicId, doctorId: user.userId },
    });
    const result = await (this.prisma as any).medicationCatalog.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        dose: dto.dose !== undefined ? dto.dose.trim() : undefined,
        frequency:
          dto.frequency !== undefined ? dto.frequency.trim() : undefined,
        duration: dto.duration !== undefined ? dto.duration.trim() : undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() : undefined,
      },
    });
    await this.invalidateCatalogCache("med", user.userId);
    return result;
  }

  async deleteMedicationCatalog(user: RequestUser, id: string) {
    this.requireDoctorCatalog(user);
    await (this.prisma as any).medicationCatalog.updateMany({
      where: { id, clinicId: user.clinicId, doctorId: user.userId },
      data: { isActive: false },
    });
    await this.invalidateCatalogCache("med", user.userId);
    return { success: true };
  }

  async listImagingCatalog(user: RequestUser, q?: string) {
    this.requireDoctorCatalog(user);
    const query = q?.trim();
    const cacheKey = this.catalogCacheKey("img", user.userId, query);
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const result = await (this.prisma as any).imagingCatalog.findMany({
      where: {
        clinicId: user.clinicId,
        doctorId: user.userId,
        isActive: true,
        ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    });
    await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  }

  async createImagingCatalog(
    user: RequestUser,
    dto: { name: string; category?: string; notes?: string },
  ) {
    this.requireDoctorCatalog(user);
    if (!dto.name?.trim()) throw new BadRequestException("name is required");
    const result = await (this.prisma as any).imagingCatalog.create({
      data: {
        clinicId: user.clinicId,
        doctorId: user.userId,
        name: dto.name.trim(),
        category: dto.category?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
      },
    });
    await this.invalidateCatalogCache("img", user.userId);
    return result;
  }

  async updateImagingCatalog(
    user: RequestUser,
    id: string,
    dto: { name?: string; category?: string; notes?: string },
  ) {
    this.requireDoctorCatalog(user);
    // HIGH-04: same doctorId check for imaging catalog
    await (this.prisma as any).imagingCatalog.findFirstOrThrow({
      where: { id, clinicId: user.clinicId, doctorId: user.userId },
    });
    const result = await (this.prisma as any).imagingCatalog.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        category: dto.category !== undefined ? dto.category.trim() : undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() : undefined,
      },
    });
    await this.invalidateCatalogCache("img", user.userId);
    return result;
  }

  async deleteImagingCatalog(user: RequestUser, id: string) {
    this.requireDoctorCatalog(user);
    await (this.prisma as any).imagingCatalog.updateMany({
      where: { id, clinicId: user.clinicId, doctorId: user.userId },
      data: { isActive: false },
    });
    await this.invalidateCatalogCache("img", user.userId);
    return { success: true };
  }

  async getPrescriptionTemplate(user: RequestUser) {
    this.requireDoctorCatalog(user);
    const cacheKey = `template:${user.userId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const template = await (this.prisma as any).prescriptionTemplate.findUnique(
      {
        where: {
          clinicId_doctorId: { clinicId: user.clinicId, doctorId: user.userId },
        },
      },
    );
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: user.clinicId },
    });
    const result = template ?? {
      title: "Prescription",
      header: {
        clinicName: clinic?.name,
        logoUrl: (clinic as any)?.logoUrl ?? null,
      },
      footer: { notes: "Get well soon" },
    };
    await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  }

  async savePrescriptionTemplate(
    user: RequestUser,
    dto: { title?: string; style?: string; header?: object; footer?: object },
  ) {
    this.requireDoctorCatalog(user);
    const title = String(dto.title ?? "Prescription").trim();
    const style = dto.style ?? "classic";
    const header = JSON.parse(JSON.stringify(dto.header ?? {}));
    const footer = JSON.parse(JSON.stringify(dto.footer ?? {}));

    const result = await (this.prisma as any).prescriptionTemplate.upsert({
      where: {
        clinicId_doctorId: { clinicId: user.clinicId, doctorId: user.userId },
      },
      create: {
        clinicId: user.clinicId,
        doctorId: user.userId,
        title,
        header: { ...header, style },
        footer,
        isDefault: true,
      },
      update: { title, header: { ...header, style }, footer, isDefault: true },
    });
    await this.cacheManager.del(`template:${user.userId}`);
    return result;
  }

  private catalogCacheKey(kind: "med" | "img", userId: string, query?: string) {
    return `catalog:${kind}:${userId}:${query ?? ""}`;
  }

  private async invalidateCatalogCache(kind: "med" | "img", userId: string) {
    await Promise.all([
      this.cacheManager.del(this.catalogCacheKey(kind, userId)),
      this.cacheManager.del(this.catalogCacheKey(kind, userId, "")),
    ]);
  }
}
