import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ClinicRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { PrismaService } from "../../core/database/prisma.service";
import { AuthSessionService } from "../../core/auth/auth-session.service";
import { CreateClinicDto } from "./dto/create-clinic.dto";
import { SubscriptionPeriod } from "./dto/create-clinic.dto";
import { UpdateClinicSettingsDto } from "./dto/update-clinic-settings.dto";
import { normalizePhone } from "../../core/auth/phone.util";

@Injectable()
export class ClinicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  // PERF-07 / CODE-02 / CODE-04: getClinicRuntimeSettings removed.
  // isActive, logoUrl, workingHours are all in the Prisma schema — include them
  // directly in each query instead of making a second raw-SQL round-trip.

  async listAll() {
    const clinics = await this.prisma.clinic.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        logoUrl: true,
        workingHours: true,
        timezone: true,
        defaultLocale: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { clinicUsers: true, patients: true, appointments: true },
        },
        ...({ subscription: { include: { plan: true } } } as any),
      },
    });
    return clinics;
  }

  async getById(clinicId: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        _count: {
          select: { clinicUsers: true, patients: true, appointments: true },
        },
        ...({ subscription: { include: { plan: true } } } as any),
      },
    });

    if (!clinic) {
      throw new NotFoundException("Clinic not found");
    }

    return clinic;
  }

  async getDirectoryDetails(clinicId: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        subscription: { include: { plan: true } } as any,
        _count: {
          select: { patients: true, appointments: true, clinicUsers: true },
        },
        clinicUsers: {
          include: { user: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!clinic) throw new NotFoundException("Clinic not found");
    return {
      id: clinic.id,
      name: clinic.name,
      slug: clinic.slug,
      isActive: clinic.isActive,
      timezone: clinic.timezone,
      defaultLocale: clinic.defaultLocale,
      subscription: (clinic as any).subscription,
      counts: clinic._count,
      staff: clinic.clinicUsers.map((member) => ({
        id: member.user.id,
        fullName: member.user.fullName,
        email: member.user.email,
        phone: (member.user as any).phone,
        avatarUrl: (member.user as any).avatarUrl,
        role: member.role,
        specialty: member.specialty,
        isActive: member.isActive,
        createdAt: member.createdAt,
      })),
    };
  }

  async create(dto: CreateClinicDto, actorId: string) {
    const existing = await this.prisma.clinic.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(
        `A clinic with slug "${dto.slug}" already exists`,
      );
    }

    // ── Atomic creation — if anything fails, nothing is persisted ──
    const { clinic, adminUser } = await this.prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug.toLowerCase().trim(),
          timezone: dto.timezone ?? "Africa/Cairo",
          defaultLocale: dto.defaultLocale ?? "ar",
        },
      });

      if (dto.subscriptionPeriod) {
        const plan = await (tx as any).subscriptionPlan.findUnique({
          where: { code: dto.subscriptionPeriod },
        });
        if (!plan) {
          throw new ConflictException(
            `Subscription plan "${dto.subscriptionPeriod}" is not configured`,
          );
        }
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + plan.durationDays);
        await (tx as any).clinicSubscription.create({
          data: {
            clinicId: clinic.id,
            planId: plan.id,
            expiresAt,
            status: "ACTIVE",
          },
        });
      }

      let adminUser: { id: string; email: string; fullName: string } | null =
        null;

      const adminLogin = (
        dto.adminLogin ||
        dto.adminEmail ||
        dto.adminPhone ||
        ""
      ).trim();
      const adminEmail = (
        dto.adminEmail || (adminLogin.includes("@") ? adminLogin : "")
      )
        .trim()
        .toLowerCase();
      const adminPhone = normalizePhone(
        dto.adminPhone || (!adminLogin.includes("@") ? adminLogin : "")
      );

      if (
        (adminEmail || adminPhone) &&
        dto.adminFullName &&
        dto.adminPassword
      ) {
        const existingUser = await tx.user.findFirst({
          where: {
            OR: [
              { email: adminEmail || undefined },
              { phone: adminPhone || undefined },
            ],
          } as any,
        });
        if ((existingUser as any)?.isSuperAdmin) {
          throw new ConflictException(
            "Cannot assign a platform admin as clinic admin",
          );
        }

        const passwordHash = await hash(dto.adminPassword, 10);
        const user = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                fullName: dto.adminFullName.trim(),
                passwordHash,
                email: adminEmail || (existingUser as any).email,
                phone: adminPhone || (existingUser as any).phone,
              } as any,
            })
          : await tx.user.create({
              data: {
                email: adminEmail || null,
                phone: adminPhone || null,
                fullName: dto.adminFullName.trim(),
                passwordHash,
                isSuperAdmin: false,
              } as any,
            });

        await tx.clinicUser.create({
          data: {
            clinicId: clinic.id,
            userId: user.id,
            role: ClinicRole.DOCTOR_ADMIN,
            isActive: true,
          } as any,
        });
        adminUser = {
          id: user.id,
          email: (user as any).email ?? (user as any).phone ?? "",
          fullName: user.fullName,
        };
      }

      await tx.auditLog.create({
        data: {
          clinicId: clinic.id,
          actorId,
          action: "CLINIC_CREATED",
          entityType: "Clinic",
          entityId: clinic.id,
          meta: {
            slug: clinic.slug,
            name: clinic.name,
            adminUserId: adminUser?.id ?? null,
          },
        },
      });

      return { clinic, adminUser };
    });

    // Apply referral code bonus OUTSIDE the transaction —
    // failure here must not roll back clinic creation
    if (dto.referralCode) {
      try {
        const referrerSlug = dto.referralCode.trim().toLowerCase();
        const referrerClinic = await (this.prisma as any).clinic.findUnique({
          where: { slug: referrerSlug },
          include: { subscription: true },
        });
        if (referrerClinic && (referrerClinic as any).subscription) {
          const sub = (referrerClinic as any).subscription;
          const now = new Date();
          const base = sub.expiresAt > now ? new Date(sub.expiresAt) : now;
          const newExpiresAt = new Date(base);
          newExpiresAt.setDate(newExpiresAt.getDate() + 10);
          await (this.prisma as any).clinicSubscription.update({
            where: { clinicId: referrerClinic.id },
            data: { expiresAt: newExpiresAt },
          });
          await this.prisma.auditLog.create({
            data: {
              clinicId: referrerClinic.id,
              actorId,
              action: "SUBSCRIPTION_REFERRAL_BONUS",
              entityType: "ClinicSubscription",
              entityId: referrerClinic.id,
              meta: { newClinicId: clinic.id, bonusDays: 10, newExpiresAt },
            },
          });
        }
      } catch {
        // Referral bonus failure should not block clinic creation
      }
    }

    return { ...clinic, adminUser };
  }

  async updateClinicStatus(
    clinicId: string,
    isActive: boolean,
    actorId: string,
  ) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
    });

    if (!clinic) {
      throw new NotFoundException("Clinic not found");
    }

    // CODE-02: Use typed Prisma update instead of raw SQL for a simple boolean field
    await this.prisma.clinic.update({
      where: { id: clinicId },
      data: { isActive },
    });

    if (isActive) {
      await this.authSessionService.clearClinicRevocation(clinicId);
    } else {
      await this.authSessionService.revokeClinicSessions(clinicId);
    }

    const updated = await this.getById(clinicId);

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        actorId,
        action: isActive ? "CLINIC_ACTIVATED" : "CLINIC_DEACTIVATED",
        entityType: "Clinic",
        entityId: clinicId,
        meta: { reason: "Manual status update" },
      },
    });

    return {
      success: true,
      clinic: updated,
      message: `Clinic ${isActive ? "activated" : "deactivated"}`,
    };
  }

  async deleteClinic(clinicId: string, actorId: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
    });
    if (!clinic) throw new NotFoundException("Clinic not found");

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        actorId,
        action: "CLINIC_DELETED",
        entityType: "Clinic",
        entityId: clinicId,
        meta: { slug: clinic.slug, name: clinic.name },
      },
    });
    await this.prisma.clinic.delete({ where: { id: clinicId } });
    return { success: true };
  }

  async getStats() {
    const [
      clinicCount,
      userCount,
      patientCount,
      appointmentCount,
      payments,
      plans,
      roles,
      monthlyRevenue,
    ] = await Promise.all([
      this.prisma.clinic.count(),
      this.prisma.user.count({ where: { isSuperAdmin: false } }),
      this.prisma.patient.count(),
      this.prisma.appointment.count(),
      this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
          SELECT status, COUNT(*) AS count
          FROM "SubscriptionPaymentRequest"
          GROUP BY status
        `,
      this.prisma.$queryRaw<
        Array<{ code: string; name: string; clinicCount: bigint }>
      >`
          SELECT sp.code::text, sp.name, COUNT(cs.id) AS "clinicCount"
          FROM "SubscriptionPlan" sp
          LEFT JOIN "ClinicSubscription" cs ON cs."planId" = sp.id
          GROUP BY sp.id, sp.code, sp.name, sp."durationDays"
          ORDER BY sp."durationDays" ASC
        `,
      this.prisma.$queryRaw<Array<{ role: string; count: bigint }>>`
          SELECT role::text, COUNT(*) AS count
          FROM "ClinicUser"
          GROUP BY role
        `,
      this.prisma.$queryRaw<Array<{ month: string; amount: string }>>`
          SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month, COALESCE(SUM("totalAmount"), 0)::text AS amount
          FROM "Invoice"
          WHERE "createdAt" >= DATE_TRUNC('year', NOW())
          GROUP BY DATE_TRUNC('month', "createdAt")
          ORDER BY DATE_TRUNC('month', "createdAt") ASC
        `,
    ]);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const previousMonthDate = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );
    const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const revenueMap = new Map(
      monthlyRevenue.map((row) => [row.month, Number(row.amount)]),
    );
    const currentMonthRevenue = revenueMap.get(currentMonth) ?? 0;
    const previousMonthRevenue = revenueMap.get(previousMonth) ?? 0;
    const growthRate =
      previousMonthRevenue > 0
        ? ((currentMonthRevenue - previousMonthRevenue) /
            previousMonthRevenue) *
          100
        : 0;
    return {
      clinicCount,
      userCount,
      patientCount,
      appointmentCount,
      payments: payments.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      plans: plans.map((row) => ({
        code: row.code,
        name: row.name,
        clinicCount: Number(row.clinicCount),
      })),
      roles: roles.map((row) => ({ role: row.role, count: Number(row.count) })),
      monthlyRevenue: monthlyRevenue.map((row) => ({
        month: row.month,
        amount: Number(row.amount),
      })),
      currentMonthRevenue,
      previousMonthRevenue,
      growthRate,
    };
  }

  async updateSettings(
    clinicId: string,
    dto: UpdateClinicSettingsDto,
    actorId: string,
  ) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
    });
    if (!clinic) throw new NotFoundException("Clinic not found");

    await this.prisma.clinic.update({
      where: { id: clinicId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.defaultLocale ? { defaultLocale: dto.defaultLocale } : {}),
      },
    });

    if (dto.logoUrl !== undefined || dto.workingHours !== undefined) {
      await this.prisma.$executeRaw`
        UPDATE "Clinic"
        SET
          "logoUrl" = COALESCE(${dto.logoUrl ?? null}, "logoUrl"),
          "workingHours" = COALESCE(${dto.workingHours ? JSON.stringify(dto.workingHours) : null}::jsonb, "workingHours"),
          "updatedAt" = NOW()
        WHERE id = ${clinicId}
      `;
    }

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        actorId,
        action: "CLINIC_SETTINGS_UPDATED",
        entityType: "Clinic",
        entityId: clinicId,
        meta: JSON.parse(JSON.stringify(dto)),
      },
    });

    return this.getById(clinicId);
  }
}
