import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ClinicRole, Prisma } from "@prisma/client";
import { PrismaService } from "../../core/database/prisma.service";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UploadService } from "../../core/upload/upload.service";

type PatientWithHistory = {
  id?: string;
  code?: string;
  fullName?: string;
  phone?: string | null;
  dateOfBirth?: Date | null;
  medicalNotes?: string | null;
  medicalHistory?: Prisma.JsonValue | null;
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async listByClinic(
    user: RequestUser,
    q?: string,
    filterDoctorId?: string,
    cursor?: string,
    limit = 50,
  ) {
    const { clinicId, userId, role } = user;
    if (!clinicId) throw new ForbiddenException("Clinic context required");
    const query = q?.trim();

    const searchFilter = query
      ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" as const } },
            { code: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {};

    let ownershipFilter: object = {};

    if (role === ClinicRole.DOCTOR_ADMIN && filterDoctorId) {
      ownershipFilter = {
        OR: [
          { createdById: filterDoctorId },
          { appointments: { some: { doctorId: filterDoctorId, clinicId } } },
        ],
      };
    }

    const includeMedicalNotes = role !== ClinicRole.RECEPTIONIST;
    const pageLimit = Math.min(Math.max(Number.isFinite(limit) ? limit : 50, 1), 100);

    // FIX: Replace fixed 200-row cap with cursor pagination for large clinics.
    // FIX: Prisma Client may be stale until migration/generate runs; cast only for new additive field.
    const patients = (await (this.prisma.patient as any).findMany({
      where: { clinicId, ...ownershipFilter, ...searchFilter },
      select: {
        id: true,
        clinicId: true,
        createdById: true,
        code: true,
        fullName: true,
        phone: true,
        dateOfBirth: true,
        medicalNotes: includeMedicalNotes,
        medicalHistory: includeMedicalNotes,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: pageLimit + 1,
    })) as PatientWithHistory[];

    const hasMore = patients.length > pageLimit;
    const data = patients.slice(0, pageLimit).map((patient) =>
      this.mergeMedicalHistory(patient, includeMedicalNotes),
    );
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
    };
  }

  async getDetails(clinicId: string, patientId: string, user: RequestUser) {
    const { userId, role } = user;
    const includeMedicalNotes = role !== ClinicRole.RECEPTIONIST;

    // DATA-03: The original code ran a Prisma include for attachments AND then
    // an identical raw SQL query right after — double-fetching the same rows.
    // We now use the Prisma include's appointmentId field directly (it exists
    // in the schema). The raw SQL is removed.
    // FIX: Prisma Client may be stale until migration/generate runs; cast only for new additive field.
    const patient = await (this.prisma.patient as any).findFirst({
      where: { id: patientId, clinicId },
      select: {
        id: true,
        clinicId: true,
        createdById: true,
        code: true,
        fullName: true,
        phone: true,
        dateOfBirth: true,
        medicalNotes: includeMedicalNotes,
        medicalHistory: includeMedicalNotes,
        createdAt: true,
        updatedAt: true,
        appointments: {
          where:
            role === ClinicRole.DOCTOR_ADMIN
              ? { doctorId: userId, clinicId }
              : { clinicId },
          orderBy: { startsAt: "desc" },
          take: 20,
          include: {
            doctor: {
              select:
                role === ClinicRole.RECEPTIONIST
                  ? { id: true, fullName: true }
                  : { id: true, fullName: true, email: true },
            },
          },
        },
        prescriptions: includeMedicalNotes
          ? {
              where:
                role === ClinicRole.DOCTOR_ADMIN ? { doctorId: userId } : {},
              orderBy: { issuedAt: "desc" },
              take: 20,
              include: {
                doctor: { select: { id: true, fullName: true, email: true } },
              },
            }
          : false,
        attachments: includeMedicalNotes
          ? {
              orderBy: { uploadedAt: "desc" },
              take: 50,
              select: {
                id: true,
                appointmentId: true, // ← was missing from the original include
                storageKey: true,
                fileName: true,
                mimeType: true,
                uploadedAt: true,
              },
            }
          : false,
      },
    });
    if (!patient) throw new NotFoundException("Patient not found");

    const attachments = includeMedicalNotes
      ? ((patient as any).attachments ?? []).map((a: any) => ({
          id: a.id,
          appointmentId: a.appointmentId ?? null,
          name: a.fileName,
          // FIX-3: Pass mimeType so generateSignedUrl uses resource_type:'raw' for PDFs.
          // Previously all attachments were signed as images → PDF URLs were broken.
          url: this.uploadService.generateSignedUrl(
            a.storageKey,
            300,
            a.mimeType,
          ),
          mimeType: a.mimeType,
          uploadedAt: a.uploadedAt,
        }))
      : [];

    // FIX: Merge structured medical history with legacy medicalNotes for backward compatibility.
    return {
      ...this.mergeMedicalHistory(patient, includeMedicalNotes),
      attachments,
    };
  }

  async countAttachments(clinicId: string, patientId: string): Promise<number> {
    return this.prisma.patientAttachment.count({
      where: { clinicId, patientId },
    });
  }

  async addAttachment(
    user: RequestUser,
    patientId: string,
    file: { url: string; fileName: string; mimeType: string },
    appointmentId?: string,
  ) {
    if (!user.clinicId) throw new NotFoundException("Clinic context required");
    await this.ensurePatientInClinic(user.clinicId, patientId);

    // DATA-04: Create attachment with appointmentId in a single atomic write.
    // The original code created the row first, then updated appointmentId in a
    // separate call — a crash between the two would leave a detached attachment.
    const attachment = await this.prisma.patientAttachment.create({
      data: {
        clinicId: user.clinicId,
        patientId,
        storageKey: file.url,
        fileName: file.fileName,
        mimeType: file.mimeType,
        ...(appointmentId ? { appointmentId } : {}),
      },
      select: {
        id: true,
        appointmentId: true,
        storageKey: true,
        fileName: true,
        mimeType: true,
        uploadedAt: true,
      },
    });

    return {
      id: attachment.id,
      appointmentId: attachment.appointmentId ?? null,
      name: attachment.fileName,
      // FIX-4: Pass mimeType so PDFs get correct resource_type in their signed URL.
      url: this.uploadService.generateSignedUrl(
        attachment.storageKey,
        300,
        attachment.mimeType,
      ),
      mimeType: attachment.mimeType,
      uploadedAt: attachment.uploadedAt,
    };
  }

  async create(user: RequestUser, dto: CreatePatientDto) {
    const { clinicId, userId, role } = user;
    const includeMedicalNotes = role !== ClinicRole.RECEPTIONIST;

    // FIX: Prisma Client may be stale until migration/generate runs; cast only for new additive field.
    return (this.prisma.patient as any).create({
      data: {
        clinicId: clinicId!,
        createdById: userId,
        code: dto.code,
        fullName: dto.fullName,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        medicalNotes: includeMedicalNotes ? dto.medicalNotes : undefined,
        // FIX: Store additive structured medical history without removing legacy notes.
        medicalHistory:
          includeMedicalNotes && dto.medicalHistory
            ? this.normalizeMedicalHistory(dto.medicalHistory)
            : undefined,
      },
    });
  }

  async exportCsv(user: RequestUser) {
    const { clinicId, role } = user;
    if (!clinicId) throw new ForbiddenException("Clinic context required");
    const includeMedicalNotes = role !== ClinicRole.RECEPTIONIST;
    // FIX: CSV export is clinic-scoped and bounded to the authenticated clinic.
    // FIX: Prisma Client may be stale until migration/generate runs; cast only for new additive field.
    const patients = (await (this.prisma.patient as any).findMany({
      where: { clinicId },
      select: {
        code: true,
        fullName: true,
        phone: true,
        dateOfBirth: true,
        medicalNotes: includeMedicalNotes,
        medicalHistory: includeMedicalNotes,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })) as PatientWithHistory[];

    return toCsv(
      ["code", "fullName", "phone", "dateOfBirth", "medicalNotes", "createdAt"],
      patients.map((patient) => {
        const merged = this.mergeMedicalHistory(patient, includeMedicalNotes);
        return [
          patient.code ?? "",
          patient.fullName ?? "",
          patient.phone ?? "",
          patient.dateOfBirth?.toISOString() ?? "",
          includeMedicalNotes ? merged.medicalNotes ?? "" : "",
          patient.createdAt?.toISOString() ?? "",
        ];
      }),
    );
  }

  /**
   * PERF-02: Fuzzy similar-name search.
   * Original ran Levenshtein against every patient × every token — O(n²) on large clinics.
   * Fix: first narrow candidates with a DB-level icontains on the first token,
   * then run the expensive fuzzy scoring only on that small result set (≤50 rows).
   */
  async findSimilar(user: RequestUser, name: string) {
    const { clinicId } = user;
    const query = name.trim().toLowerCase();
    if (!query || query.length < 2) return [];

    const queryTokens = query
      .split(/\s+/)
      .map((t) => t.replace(/[^a-zأ-ي]/g, ""))
      .filter(Boolean);

    // Pre-filter in the DB using the first (longest) token — reduces the JS set drastically
    const primaryToken = [...queryTokens].sort(
      (a, b) => b.length - a.length,
    )[0];
    const candidates = await this.prisma.patient.findMany({
      where: {
        clinicId,
        fullName: { contains: primaryToken, mode: "insensitive" },
      },
      select: { id: true, code: true, fullName: true, phone: true },
      take: 50,
    });

    const scored = candidates.map((p) => {
      const nameTokens = p.fullName
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^a-zأ-ي]/g, ""))
        .filter(Boolean);

      const matches = queryTokens.filter((qt) =>
        nameTokens.some(
          (nt) =>
            nt.includes(qt) || qt.includes(nt) || levenshtein(qt, nt) <= 1,
        ),
      ).length;

      const score =
        matches / Math.max(queryTokens.length, nameTokens.length, 1);
      return { ...p, score };
    });

    return scored
      .filter((p) => p.score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score: _s, ...p }) => p);
  }

  private async ensurePatientInClinic(clinicId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, clinicId },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException("Patient not found");
  }

  private normalizeMedicalHistory(value: {
    chronic?: string[];
    allergies?: string[];
    permanentMeds?: string[];
    notes?: string;
  }): Prisma.JsonObject {
    return {
      chronic: value.chronic ?? [],
      allergies: value.allergies ?? [],
      permanentMeds: value.permanentMeds ?? [],
      notes: value.notes ?? "",
    };
  }

  private mergeMedicalHistory<T extends { medicalNotes?: string | null; medicalHistory?: Prisma.JsonValue | null }>(
    patient: T,
    includeMedicalNotes: boolean,
  ): T & {
    medicalHistory?: {
      chronic: string[];
      allergies: string[];
      permanentMeds: string[];
      notes: string;
    } | null;
  } {
    if (!includeMedicalNotes) return patient as T & {
      medicalHistory?: {
        chronic: string[];
        allergies: string[];
        permanentMeds: string[];
        notes: string;
      } | null;
    };
    const raw =
      patient.medicalHistory && typeof patient.medicalHistory === "object" && !Array.isArray(patient.medicalHistory)
        ? patient.medicalHistory
        : {};
    const record = raw as Record<string, unknown>;
    const structured = {
      chronic: Array.isArray(record.chronic) ? record.chronic.filter((v): v is string => typeof v === "string") : [],
      allergies: Array.isArray(record.allergies) ? record.allergies.filter((v): v is string => typeof v === "string") : [],
      permanentMeds: Array.isArray(record.permanentMeds) ? record.permanentMeds.filter((v): v is string => typeof v === "string") : [],
      notes:
        typeof record.notes === "string"
          ? record.notes
          : patient.medicalNotes ?? "",
    };
    return {
      ...patient,
      medicalHistory: structured,
      medicalNotes: patient.medicalNotes ?? structured.notes,
    };
  }
}

function toCsv(headers: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

// ── Levenshtein helper (small strings only) ─────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
