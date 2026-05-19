import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ClinicRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { PrismaService } from "../../core/database/prisma.service";
import { CreateClinicDoctorDto } from "./dto/create-clinic-doctor.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateDoctorPaymentDto } from "./dto/update-doctor-payment.dto";
import { DOCTOR_ROLE } from "../../core/auth/rbac/role-permissions";
import { normalizePhone } from "../../core/auth/phone.util";
import { AuthSessionService } from "../../core/auth/auth-session.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async listPlatformDirectory(filters: {
    role?: ClinicRole;
    clinicId?: string;
    q?: string;
  }) {
    const q = filters.q?.trim() || null;
    const role = filters.role ?? null;
    const clinicId = filters.clinicId ?? null;
    return this.prisma.$queryRaw`
      SELECT
        cu.id,
        cu."userId",
        u.email,
        u.phone,
        u."fullName",
        cu.role,
        cu.specialty,
        cu."subscriptionPeriod",
        cu."isActive",
        cu."createdAt",
        jsonb_build_object(
          'id', c.id,
          'slug', c.slug,
          'name', c.name,
          'isActive', c."isActive"
        ) AS clinic
      FROM "ClinicUser" cu
      JOIN "User" u ON u.id = cu."userId"
      JOIN "Clinic" c ON c.id = cu."clinicId"
      WHERE (${role}::text IS NULL OR cu.role::text = ${role}::text)
        AND (${clinicId}::text IS NULL OR cu."clinicId" = ${clinicId})
        AND (
          ${q}::text IS NULL
          OR u."fullName" ILIKE '%' || ${q} || '%'
          OR u.email ILIKE '%' || ${q} || '%'
          OR COALESCE(u.phone, '') ILIKE '%' || ${q} || '%'
          OR c.name ILIKE '%' || ${q} || '%'
          OR c.slug ILIKE '%' || ${q} || '%'
        )
      ORDER BY cu."createdAt" DESC
      LIMIT 200
    `;
  }

  // ✅ FIX: createReceptionist يقبل email أو phone (مش لازم الاتنين)
  async createReceptionist(
    clinicId: string,
    dto: CreateClinicDoctorDto,
    actorUserId: string,
  ) {
    const normalizedEmail = dto.email?.toLowerCase().trim() || null;
    const normalizedPhone = normalizePhone(dto.phone);

    // ✅ لازم يكون في email أو phone على الأقل
    if (!normalizedEmail && !normalizedPhone) {
      throw new ConflictException(
        "Email or phone is required to create a receptionist",
      );
    }

    const passwordHash = await hash(dto.password, 10);
    const fullName = dto.fullName.trim();

    // ✅ البحث بـ email أو phone
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      } as any,
    });

    let userId: string;

    if (existingUser) {
      if (existingUser.isSuperAdmin) {
        throw new ForbiddenException(
          "Cannot assign platform users as clinic staff",
        );
      }
      const membership = await this.prisma.clinicUser.findUnique({
        where: { clinicId_userId: { clinicId, userId: existingUser.id } },
      });
      if (membership) {
        throw new ConflictException("This user already belongs to this clinic");
      }
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName,
          passwordHash,
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
          ...(normalizedPhone ? { phone: normalizedPhone } : {}),
        } as any,
      });
      userId = existingUser.id;
    } else {
      const created = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          phone: normalizedPhone,
          fullName,
          passwordHash,
          isSuperAdmin: false,
        } as any,
      });
      userId = created.id;
    }

    const clinicUser = await this.prisma.clinicUser.create({
      data: {
        clinicId,
        userId,
        role: ClinicRole.RECEPTIONIST,
        isActive: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        actorId: actorUserId,
        action: "CLINIC_RECEPTIONIST_CREATED",
        entityType: "User",
        entityId: userId,
        meta: { userId, role: ClinicRole.RECEPTIONIST },
      },
    });

    const userRow = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const clinic = await this.prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
    });

    return {
      id: userRow.id,
      clinicUserId: clinicUser.id,
      email: userRow.email,
      phone: (userRow as any).phone,
      fullName: userRow.fullName,
      role: ClinicRole.RECEPTIONIST,
      clinicSlug: clinic.slug,
      clinicName: clinic.name,
    };
  }

  async listClinicDoctors(clinicId: string) {
    const rows = await this.prisma.clinicUser.findMany({
      where: { clinicId, role: { in: [ClinicRole.DOCTOR_ADMIN, DOCTOR_ROLE] } },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      id: r.user.id,
      email: r.user.email,
      phone: (r.user as any).phone,
      avatarUrl: (r.user as any).avatarUrl,
      fullName: r.user.fullName,
      role: r.role,
      specialty: r.specialty,
      paymentMode: (r as any).paymentMode,
      fixedMonthlyRent: (r as any).fixedMonthlyRent,
      adminPercentage: (r as any).adminPercentage,
      consultationFee: (r as any).consultationFee,
      followUpFee: (r as any).followUpFee,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));
  }

  async listReceptionists(clinicId: string) {
    const rows = await this.prisma.clinicUser.findMany({
      where: { clinicId, role: ClinicRole.RECEPTIONIST },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      id: r.user.id,
      email: r.user.email,
      phone: (r.user as any).phone,
      avatarUrl: (r.user as any).avatarUrl,
      fullName: r.user.fullName,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));
  }

  async listClinicStaff(clinicId: string) {
    const rows = await this.prisma.clinicUser.findMany({
      where: { clinicId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      id: r.user.id,
      email: r.user.email,
      phone: (r.user as any).phone,
      avatarUrl: (r.user as any).avatarUrl,
      fullName: r.user.fullName,
      role: r.role,
      specialty: r.specialty,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));
  }

  async updateStaffStatus(
    clinicId: string,
    userId: string,
    isActive: boolean,
    actorUserId: string,
  ) {
    const clinicUser = await this.prisma.clinicUser.findUnique({
      where: { clinicId_userId: { clinicId, userId } },
      include: { user: true },
    });

    if (!clinicUser) {
      throw new ConflictException("User does not belong to this clinic");
    }

    const updated = await this.prisma.clinicUser.update({
      where: { id: clinicUser.id },
      data: { isActive },
      include: { user: true },
    });

    // Force logout the user immediately when deactivated,
    // or clear the revocation flag when re-activated.
    if (isActive) {
      await this.authSessionService.clearUserRevocation(userId);
    } else {
      await this.authSessionService.revokeUserSessions(userId);
    }

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        actorId: actorUserId,
        action: isActive
          ? "CLINIC_STAFF_ACTIVATED"
          : "CLINIC_STAFF_DEACTIVATED",
        entityType: "User",
        entityId: userId,
        meta: { role: updated.role },
      },
    });

    return {
      id: updated.user.id,
      email: updated.user.email,
      phone: (updated.user as any).phone,
      fullName: updated.user.fullName,
      role: updated.role,
      isActive: updated.isActive,
    };
  }

  async getStaffDetails(clinicId: string, userId: string) {
    const staff = await this.prisma.clinicUser.findUnique({
      where: { clinicId_userId: { clinicId, userId } },
      include: { user: true },
    });
    if (!staff)
      throw new ConflictException("User does not belong to this clinic");
    return {
      id: staff.user.id,
      email: staff.user.email,
      phone: (staff.user as any).phone,
      avatarUrl: (staff.user as any).avatarUrl,
      fullName: staff.user.fullName,
      role: staff.role,
      specialty: staff.specialty,
      subscriptionPeriod: (staff as any).subscriptionPeriod,
      paymentMode: (staff as any).paymentMode,
      fixedMonthlyRent: (staff as any).fixedMonthlyRent,
      adminPercentage: (staff as any).adminPercentage,
      isActive: staff.isActive,
      createdAt: staff.createdAt,
    };
  }

  async deleteStaff(clinicId: string, userId: string, actorUserId: string) {
    const staff = await this.prisma.clinicUser.findUnique({
      where: { clinicId_userId: { clinicId, userId } },
    });
    if (!staff)
      throw new ConflictException("User does not belong to this clinic");
    if (
      staff.role === ClinicRole.DOCTOR_ADMIN &&
      staff.userId === actorUserId
    ) {
      throw new ForbiddenException(
        "You cannot remove your own clinic admin access",
      );
    }
    await this.prisma.clinicUser.delete({ where: { id: staff.id } });
    await this.prisma.auditLog.create({
      data: {
        clinicId,
        actorId: actorUserId,
        action: "CLINIC_STAFF_DELETED",
        entityType: "User",
        entityId: userId,
        meta: { role: staff.role },
      },
    });
    return { success: true };
  }

  async updateDoctorPayment(
    clinicId: string,
    userId: string,
    dto: UpdateDoctorPaymentDto,
  ) {
    const staff = await this.prisma.clinicUser.findUnique({
      where: { clinicId_userId: { clinicId, userId } },
    });
    if (
      !staff ||
      ![ClinicRole.DOCTOR_ADMIN, DOCTOR_ROLE].includes(staff.role)
    ) {
      throw new ConflictException("Doctor does not belong to this clinic");
    }
    await this.prisma.clinicUser.update({
      where: { id: staff.id },
      data: {
        paymentMode: dto.paymentMode as any,
        fixedMonthlyRent:
          dto.paymentMode === "FIXED_RENT" ? (dto.fixedMonthlyRent ?? 0) : null,
        adminPercentage:
          dto.paymentMode === "PERCENTAGE" ? (dto.adminPercentage ?? 0) : null,
        consultationFee: dto.consultationFee ?? null,
        followUpFee: dto.followUpFee ?? null,
      } as any,
    });
    const updated = await this.prisma.clinicUser.findUniqueOrThrow({
      where: { id: staff.id },
    });
    return {
      id: userId,
      fullName: "Clinic-level setting",
      paymentMode: (updated as any).paymentMode,
      fixedMonthlyRent: (updated as any).fixedMonthlyRent,
      adminPercentage: (updated as any).adminPercentage,
      consultationFee: (updated as any).consultationFee,
      followUpFee: (updated as any).followUpFee,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return {
      id: user.id,
      email: user.email,
      phone: (user as any).phone,
      avatarUrl: (user as any).avatarUrl,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
    };
  }

  // ✅ FIX: updateProfile لا يغير email (ده بيتعمل عن طريق auth/email-change)
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const normalizedPhone = normalizePhone(dto.phone);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: normalizedPhone } : {}),
        ...(dto.avatarUrl !== undefined
          ? { avatarUrl: dto.avatarUrl?.trim() || null }
          : {}),
      } as any,
    });
    return {
      id: updated.id,
      email: updated.email,
      phone: (updated as any).phone,
      avatarUrl: (updated as any).avatarUrl,
      fullName: updated.fullName,
    };
  }
}
