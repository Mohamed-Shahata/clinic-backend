import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { ClinicRole, Prisma } from "@prisma/client";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { CreateSubscriptionPaymentRequestDto } from "./dto/create-subscription-payment-request.dto";
import { CreateSubscriptionPlanDto } from "./dto/create-subscription-plan.dto";
import { ReviewSubscriptionPaymentRequestDto } from "./dto/review-subscription-payment-request.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { UpdateSubscriptionPlanDto } from "./dto/update-subscription-plan.dto";
import { CreatePublicSubscriptionPaymentRequestDto } from "./dto/create-subscription-payment-request.dto";
import { AuthSessionService } from "../../core/auth/auth-session.service";

type InvoiceRow = {
  id: string;
  clinicId: string;
  patientId: string;
  appointmentId: string | null;
  issuedById: string;
  totalAmount: string;
  paymentMethod: string;
  status: string;
  services: unknown;
  createdAt: Date;
};

type InvoiceView = InvoiceRow & {
  patient: { id: string; code: string; fullName: string } | null;
};

const SubscriptionRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

type SubscriptionRequestStatusValue =
  (typeof SubscriptionRequestStatus)[keyof typeof SubscriptionRequestStatus];

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async listSubscriptionPlans() {
    return (this.prisma as any).subscriptionPlan.findMany({
      where: {
        isActive: true,
        price: { gt: 0 }, // hide free/zero-price plans from doctors
      },
      orderBy: { durationDays: "asc" },
    });
  }

  async listSubscriptionPlansManage() {
    const plans = await (this.prisma as any).subscriptionPlan.findMany({
      orderBy: [{ durationDays: "asc" }, { name: "asc" }],
    });

    return plans;
  }

  async createSubscriptionPlan(dto: CreateSubscriptionPlanDto) {
    const prismaPlans = this.prisma as any;
    const slugPart =
      dto.code?.trim().toUpperCase().replace(/\s+/g, "_") ||
      `CUSTOM_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const code = slugPart.length > 80 ? slugPart.slice(0, 80) : slugPart;
    const exists = await prismaPlans.subscriptionPlan.findUnique({
      where: { code },
    });
    if (exists)
      throw new BadRequestException(
        "Duplicate plan code — choose another code.",
      );

    return prismaPlans.subscriptionPlan.create({
      data: {
        code,
        name: dto.name.trim(),
        durationDays: dto.durationDays,
        price: dto.price,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateSubscriptionPlan(planId: string, dto: UpdateSubscriptionPlanDto) {
    const prismaPlans = this.prisma as any;
    const existing = await prismaPlans.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!existing) throw new NotFoundException("Plan not found");

    return prismaPlans.subscriptionPlan.update({
      where: { id: planId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.durationDays !== undefined
          ? { durationDays: dto.durationDays }
          : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteSubscriptionPlan(planId: string) {
    const prismaPlans = this.prisma as any;
    const existing = await prismaPlans.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!existing) throw new NotFoundException("Plan not found");

    // Check if any clinic is currently on this plan
    const activeSubscriptions = await prismaPlans.clinicSubscription.count({
      where: { planId },
    });
    if (activeSubscriptions > 0) {
      throw new BadRequestException(
        "Cannot delete a plan that is currently assigned to one or more clinics",
      );
    }

    await prismaPlans.subscriptionPlan.delete({ where: { id: planId } });
    return { deleted: true };
  }

  async getCurrentSubscription(user: RequestUser) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");
    return (this.prisma as any).clinicSubscription.findUnique({
      where: { clinicId: user.clinicId },
      include: { plan: true },
    });
  }

  async createSubscriptionPaymentRequest(
    user: RequestUser,
    dto: CreateSubscriptionPaymentRequestDto,
  ) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");

    const plan = await (this.prisma as any).subscriptionPlan.findFirst({
      where: { id: dto.planId, isActive: true },
    });
    if (!plan) throw new NotFoundException("Subscription plan not found");
    if (!dto.transferPhone.trim()) {
      throw new BadRequestException("Transfer phone is required");
    }

    const request = await (
      this.prisma as any
    ).subscriptionPaymentRequest.create({
      data: {
        clinicId: user.clinicId,
        planId: plan.id,
        requestedById: user.userId,
        transferPhone: dto.transferPhone.trim(),
        screenshotUrl: dto.screenshotUrl.trim(),
        notes: dto.notes?.trim() || null,
      },
      include: { clinic: true, plan: true, requestedBy: true },
    });

    await this.prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        actorId: user.userId,
        action: "SUBSCRIPTION_PAYMENT_REQUESTED",
        entityType: "SubscriptionPaymentRequest",
        entityId: request.id,
        meta: { planId: plan.id, requestId: request.id },
      },
    });

    // Notify all super-admins about the new subscription request
    try {
      const superAdmins = await this.prisma.user.findMany({
        where: { isSuperAdmin: true },
        select: { id: true },
      });
      const clinicName = (request as any).clinic?.name ?? user.clinicId;
      const planName = (request as any).plan?.name ?? "";
      for (const admin of superAdmins) {
        await this.notifications.createForUser(
          admin.id,
          "SUBSCRIPTION_PAYMENT_REQUESTED",
          `طلب تجديد اشتراك جديد 💳`,
          `عيادة "${clinicName}" تطلب تجديد الاشتراك على باقة "${planName}". اضغط للمراجعة.`,
          {
            requestId: request.id,
            clinicId: user.clinicId,
            clinicName,
            planName,
            link: `/dashboard/super-admin/subscription-requests`,
          },
        );
      }
    } catch {
      // Notification failure should not block the request creation
    }

    return request;
  }

  async createPublicSubscriptionPaymentRequest(
    dto: CreatePublicSubscriptionPaymentRequestDto,
  ) {
    const email = dto.login.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException("Doctor email not found");

    const memberships = await this.prisma.clinicUser.findMany({
      where: {
        userId: user.id,
        role: "DOCTOR_ADMIN" as any,
      },
      include: { clinic: { include: { subscription: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (memberships.length === 0) {
      throw new NotFoundException("No clinic admin account found");
    }

    const membership = memberships[0];
    const subscription = (membership.clinic as any).subscription;
    if (
      membership.clinic.isActive &&
      subscription?.status === "ACTIVE" &&
      new Date(subscription.expiresAt) > new Date()
    ) {
      throw new BadRequestException("Clinic subscription is already active");
    }

    return this.createSubscriptionPaymentRequest(
      {
        userId: user.id,
        clinicId: membership.clinicId,
        clinicSlug: membership.clinic.slug,
        clinicName: membership.clinic.name,
        role: "DOCTOR_ADMIN" as any,
        isSuperAdmin: false,
        email: user.email,
      },
      dto,
    );
  }

  async listSubscriptionPaymentRequests(
    status?: SubscriptionRequestStatusValue,
  ) {
    const requests = await (
      this.prisma as any
    ).subscriptionPaymentRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        clinic: true,
        plan: true,
        requestedBy: {
          select: { id: true, email: true, fullName: true },
        },
        reviewedBy: {
          select: { id: true, email: true, fullName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return requests.map((request: any) => ({
      ...request,
      transferPhone: this.maskPhone(request.transferPhone),
    }));
  }

  private maskPhone(phone: string) {
    return phone.replace(/(\d{3})\d+(?=\d{3})/, "$1****");
  }

  async reviewSubscriptionPaymentRequest(
    requestId: string,
    reviewer: RequestUser,
    dto: ReviewSubscriptionPaymentRequestDto,
  ) {
    const request = await (
      this.prisma as any
    ).subscriptionPaymentRequest.findUnique({
      where: { id: requestId },
      include: { plan: true },
    });
    if (!request)
      throw new NotFoundException("Subscription payment request not found");
    if (request.status !== SubscriptionRequestStatus.PENDING) {
      throw new BadRequestException(
        "Subscription payment request was already reviewed",
      );
    }

    const reviewed = await this.prisma.$transaction(async (tx) => {
      const updatedRequest = await (
        tx as any
      ).subscriptionPaymentRequest.update({
        where: { id: requestId },
        data: {
          status: dto.approved
            ? SubscriptionRequestStatus.APPROVED
            : SubscriptionRequestStatus.REJECTED,
          reviewedById: reviewer.userId,
          reviewedAt: new Date(),
          rejectionReason: dto.approved
            ? null
            : dto.rejectionReason?.trim() || null,
        },
        include: { clinic: true, plan: true },
      });

      if (dto.approved) {
        const current = await (tx as any).clinicSubscription.findUnique({
          where: { clinicId: request.clinicId },
        });
        const start =
          current && current.expiresAt > new Date()
            ? current.expiresAt
            : new Date();
        const expiresAt = new Date(start);
        expiresAt.setDate(expiresAt.getDate() + request.plan.durationDays);

        await (tx as any).clinicSubscription.upsert({
          where: { clinicId: request.clinicId },
          create: {
            clinicId: request.clinicId,
            planId: request.planId,
            startsAt: start,
            expiresAt,
            status: "ACTIVE",
          },
          update: {
            planId: request.planId,
            startsAt: start,
            expiresAt,
            status: "ACTIVE",
          },
        });
      }

      return updatedRequest;
    });

    if (dto.approved) {
      await this.authSessionService.clearClinicRevocation(request.clinicId);
    }

    await this.prisma.auditLog.create({
      data: {
        clinicId: request.clinicId,
        actorId: reviewer.userId,
        action: dto.approved
          ? "SUBSCRIPTION_PAYMENT_APPROVED"
          : "SUBSCRIPTION_PAYMENT_REJECTED",
        entityType: "SubscriptionPaymentRequest",
        entityId: request.id,
        meta: { planId: request.planId },
      },
    });

    // Notify all DOCTOR_ADMIN members of the clinic
    try {
      const members = await this.prisma.clinicUser.findMany({
        where: {
          clinicId: request.clinicId,
          role: "DOCTOR_ADMIN" as any,
          isActive: true,
        },
        select: { userId: true },
      });
      const planName = (request as any).plan?.name ?? "";
      for (const m of members) {
        await this.notifications.createForUser(
          m.userId,
          dto.approved ? "SUBSCRIPTION_APPROVED" : "SUBSCRIPTION_REJECTED",
          dto.approved ? "تم قبول طلب الاشتراك ✓" : "تم رفض طلب الاشتراك",
          dto.approved
            ? `تم تفعيل باقة "${planName}" بنجاح. يمكنك الاستمرار في استخدام المنصة.`
            : `تم رفض طلب تجديد الاشتراك.${reviewed.rejectionReason ? " السبب: " + reviewed.rejectionReason : ""}`,
          { requestId: request.id, planName, approved: dto.approved },
        );
      }
    } catch {
      // Notification failure should not block the review response
    }

    return reviewed;
  }

  async applyReferralCode(referralCode: string, newClinicId: string) {
    // Find clinic whose slug matches the referral code (slug is their unique code)
    const referrerClinic = await (this.prisma as any).clinic.findUnique({
      where: { slug: referralCode.trim().toLowerCase() },
      include: { subscription: true },
    });
    if (!referrerClinic) return; // Invalid code — silently ignore

    const sub = (referrerClinic as any).subscription;
    if (!sub) return; // Referrer has no subscription — nothing to extend

    const now = new Date();
    const base = sub.expiresAt > now ? new Date(sub.expiresAt) : now;
    const newExpiresAt = new Date(base);
    newExpiresAt.setDate(newExpiresAt.getDate() + 10); // 10 bonus days

    await (this.prisma as any).clinicSubscription.update({
      where: { clinicId: referrerClinic.id },
      data: { expiresAt: newExpiresAt },
    });

    await this.prisma.auditLog.create({
      data: {
        clinicId: referrerClinic.id,
        action: "SUBSCRIPTION_REFERRAL_BONUS",
        entityType: "ClinicSubscription",
        entityId: referrerClinic.id,
        meta: { newClinicId, bonusDays: 10, newExpiresAt },
      },
    });
  }

  async extendSubscription(
    actor: RequestUser,
    dto: { clinicId?: string; days: number; reason?: string },
  ) {
    if (!actor.isSuperAdmin) throw new ForbiddenException("Super-admin only");
    if (!dto.days || dto.days < 1 || dto.days > 3650)
      throw new BadRequestException("Days must be between 1 and 3650");

    // Resolve target clinics
    const clinicIds: string[] = [];
    if (dto.clinicId) {
      const clinic = await this.prisma.clinic.findUnique({
        where: { id: dto.clinicId },
      });
      if (!clinic) throw new NotFoundException("Clinic not found");
      clinicIds.push(dto.clinicId);
    } else {
      const clinics = await this.prisma.clinic.findMany({
        select: { id: true },
      });
      clinicIds.push(...clinics.map((c) => c.id));
    }

    // CRIT-07: Replace the sequential per-clinic loop (250+ DB calls) with:
    // 1. One bulk SELECT to get all subscriptions
    // 2. One $transaction with batched UPDATEs
    // 3. Parallel notification fan-out
    const now = new Date();

    const existingSubs = await (this.prisma as any).clinicSubscription.findMany(
      {
        where: { clinicId: { in: clinicIds } },
        select: { clinicId: true, expiresAt: true },
      },
    );

    const subMap = new Map<string, Date>(
      existingSubs.map((s: any) => [s.clinicId, s.expiresAt]),
    );

    // Build result list and update payloads
    const results: Array<{ clinicId: string; newExpiresAt: Date | null }> = [];
    const updates: Array<{ clinicId: string; newExpiresAt: Date }> = [];

    for (const clinicId of clinicIds) {
      const currentExpiry = subMap.get(clinicId);
      if (!currentExpiry) {
        results.push({ clinicId, newExpiresAt: null });
        continue;
      }
      const base = currentExpiry > now ? new Date(currentExpiry) : now;
      const newExpiresAt = new Date(base);
      newExpiresAt.setDate(newExpiresAt.getDate() + dto.days);
      updates.push({ clinicId, newExpiresAt });
      results.push({ clinicId, newExpiresAt });
    }

    if (updates.length > 0) {
      await this.prisma.$executeRaw`
        UPDATE "ClinicSubscription"
        SET
          "expiresAt" = CASE "clinicId"
            ${Prisma.join(
              updates.map(
                ({ clinicId, newExpiresAt }) =>
                  Prisma.sql`WHEN ${clinicId} THEN ${newExpiresAt}`,
              ),
              " ",
            )}
          END,
          "status" = 'ACTIVE',
          "updatedAt" = NOW()
        WHERE "clinicId" IN (${Prisma.join(updates.map((u) => u.clinicId))})
      `;
    }

    // Parallel notification + audit log fan-out
    const membersByClinic = await this.prisma.clinicUser.findMany({
      where: {
        clinicId: { in: updates.map((u) => u.clinicId) },
        role: ClinicRole.DOCTOR_ADMIN,
        isActive: true,
      },
      select: { clinicId: true, userId: true },
    });
    const memberMap = new Map<string, string[]>();
    for (const member of membersByClinic) {
      const list = memberMap.get(member.clinicId) ?? [];
      list.push(member.userId);
      memberMap.set(member.clinicId, list);
    }

    await Promise.all(
      updates.map(async ({ clinicId, newExpiresAt }) => {
        try {
          await Promise.all(
            (memberMap.get(clinicId) ?? []).map((userId) =>
              this.notifications.createForUser(
                userId,
                "SUBSCRIPTION_EXTENDED",
                `تم تمديد اشتراكك 🎁`,
                `تمت إضافة ${dto.days} يوم إضافي لاشتراكك.${dto.reason ? " " + dto.reason : ""} صلاحية الاشتراك الجديدة: ${newExpiresAt.toLocaleDateString("ar-EG")}`,
                { days: dto.days, reason: dto.reason, newExpiresAt },
              ),
            ),
          );
        } catch {
          // ignore notification failures
        }

        await this.prisma.auditLog.create({
          data: {
            clinicId,
            actorId: actor.userId,
            action: "SUBSCRIPTION_EXTENDED",
            entityType: "ClinicSubscription",
            entityId: clinicId,
            meta: { days: dto.days, reason: dto.reason ?? null, newExpiresAt },
          },
        });
      }),
    );

    return { extended: results.filter((r) => r.newExpiresAt).length, results };
  }

  async list(user: RequestUser, cursor?: string, limit = 50) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");

    // PERF-04: cursor-based pagination (was hardcoded LIMIT 100 with no OFFSET)
    const pageLimit = Math.min(Math.max(1, limit), 100);

    if (cursor) {
      return this.prisma.$queryRaw<InvoiceView[]>`
        SELECT
          i.*,
          json_build_object('id', p.id, 'code', p.code, 'fullName', p."fullName") AS patient
        FROM "Invoice" i
        LEFT JOIN "Patient" p ON p.id = i."patientId"
        WHERE i."clinicId" = ${user.clinicId}
          AND i."createdAt" < (SELECT "createdAt" FROM "Invoice" WHERE id = ${cursor} LIMIT 1)
        ORDER BY i."createdAt" DESC
        LIMIT ${pageLimit}
      `;
    }

    return this.prisma.$queryRaw<InvoiceView[]>`
      SELECT
        i.*,
        json_build_object('id', p.id, 'code', p.code, 'fullName', p."fullName") AS patient
      FROM "Invoice" i
      LEFT JOIN "Patient" p ON p.id = i."patientId"
      WHERE i."clinicId" = ${user.clinicId}
      ORDER BY i."createdAt" DESC
      LIMIT ${pageLimit}
    `;
  }

  async doctorEarnings(user: RequestUser) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");
    const doctorFilter =
      user.role === ClinicRole.DOCTOR_ADMIN ? user.userId : null;
    const rows = await this.prisma.$queryRaw<
      Array<{
        doctorId: string;
        doctorName: string;
        role: ClinicRole;
        paymentMode: string | null;
        fixedMonthlyRent: string | null;
        adminPercentage: string | null;
        patientCount: bigint;
        grossAmount: string;
      }>
    >`
      SELECT
        u.id AS "doctorId",
        u."fullName" AS "doctorName",
        cu.role AS role,
        cu."paymentMode"::text AS "paymentMode",
        cu."fixedMonthlyRent"::text AS "fixedMonthlyRent",
        cu."adminPercentage"::text AS "adminPercentage",
        COUNT(DISTINCT i."patientId") AS "patientCount",
        COALESCE(SUM(i."totalAmount"), 0)::text AS "grossAmount"
      FROM "ClinicUser" cu
      JOIN "User" u ON u.id = cu."userId"
      LEFT JOIN "Invoice" i ON i."clinicId" = cu."clinicId"
      LEFT JOIN "Appointment" a ON a.id = i."appointmentId"
      WHERE cu."clinicId" = ${user.clinicId}
        AND cu.role IN ('DOCTOR_ADMIN', 'DOCTOR')
        AND (
          (i."appointmentId" IS NOT NULL AND a."doctorId" = u.id)
          OR (i."appointmentId" IS NULL AND i."issuedById" = u.id)
        )
        AND (${doctorFilter}::text IS NULL OR u.id = ${doctorFilter})
      GROUP BY u.id, u."fullName", cu.role, cu."paymentMode", cu."fixedMonthlyRent", cu."adminPercentage"
      ORDER BY u."fullName" ASC
    `;
    const adminRow = rows.find((row) => row.role === ClinicRole.DOCTOR_ADMIN);
    const adminPolicy = adminRow?.paymentMode ?? null;
    const adminFixed = Number(adminRow?.fixedMonthlyRent ?? 0);
    const adminPercentage = Number(adminRow?.adminPercentage ?? 0);

    const mapped = rows.map((row) => {
      const gross = Number(row.grossAmount ?? 0);
      const deduction =
        adminPolicy === "FIXED_RENT"
          ? adminFixed
          : adminPolicy === "PERCENTAGE"
            ? gross * (adminPercentage / 100)
            : 0;
      return {
        ...row,
        patientCount: Number(row.patientCount),
        grossAmount: gross,
        deduction,
        netAmount: gross - deduction,
      };
    });

    const totalAdminCollected = mapped
      .filter((row) => row.role !== ClinicRole.DOCTOR_ADMIN)
      .reduce((sum, row) => sum + Number(row.deduction || 0), 0);
    const finalRows = mapped.map((row) =>
      row.role === ClinicRole.DOCTOR_ADMIN
        ? {
            ...row,
            adminCollected: totalAdminCollected,
            netAmount: Number(row.netAmount) + totalAdminCollected,
          }
        : row,
    );

    if (user.role !== ClinicRole.DOCTOR_ADMIN) {
      return finalRows;
    }

    const details = await this.prisma.$queryRaw<
      Array<{
        invoiceId: string;
        totalAmount: string;
        createdAt: Date;
        patientName: string | null;
      }>
    >`
      SELECT
        i.id AS "invoiceId",
        i."totalAmount"::text AS "totalAmount",
        i."createdAt" AS "createdAt",
        p."fullName" AS "patientName"
      FROM "Invoice" i
      LEFT JOIN "Appointment" a ON a.id = i."appointmentId"
      LEFT JOIN "Patient" p ON p.id = i."patientId"
      WHERE i."clinicId" = ${user.clinicId}
        AND (
          a."doctorId" = ${user.userId}
          OR (i."appointmentId" IS NULL AND i."issuedById" = ${user.userId})
        )
      ORDER BY i."createdAt" DESC
      LIMIT 200
    `;

    const doctorRow = finalRows[0] ?? {
      doctorId: user.userId,
      doctorName: "Doctor",
      role: ClinicRole.DOCTOR_ADMIN,
      paymentMode: adminPolicy,
      fixedMonthlyRent: String(adminFixed || 0),
      adminPercentage: String(adminPercentage || 0),
      patientCount: 0,
      grossAmount: 0,
      deduction: 0,
      netAmount: 0,
    };
    const breakdown = details.map((row) => {
      const gross = Number(row.totalAmount ?? 0);
      const deducted =
        adminPolicy === "FIXED_RENT"
          ? adminFixed
          : adminPolicy === "PERCENTAGE"
            ? gross * (adminPercentage / 100)
            : 0;
      return {
        invoiceId: row.invoiceId,
        patientName: row.patientName ?? "—",
        createdAt: row.createdAt,
        grossAmount: gross,
        addedToDoctor: gross - deducted,
        deductedToAdmin: deducted,
      };
    });

    return [{ ...doctorRow, breakdown }];
  }

  async doctorMonthlyStats(user: RequestUser) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");
    if (user.role !== ClinicRole.DOCTOR_ADMIN)
      throw new ForbiddenException("Doctor access required");

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );

    // PERF-05: Run all 4 independent queries in parallel instead of sequentially
    const [adminRow, invoices, prevInvoices, todayStats, allPatients] =
      await Promise.all([
        this.prisma.$queryRaw<
          Array<{
            paymentMode: string | null;
            fixedMonthlyRent: string | null;
            adminPercentage: string | null;
          }>
        >`
        SELECT cu."paymentMode"::text, cu."fixedMonthlyRent"::text, cu."adminPercentage"::text
        FROM "ClinicUser" cu
        WHERE cu."clinicId" = ${user.clinicId} AND cu.role = 'DOCTOR_ADMIN'
        LIMIT 1
      `,
        this.prisma.$queryRaw<
          Array<{
            totalAmount: string;
            createdAt: Date;
            patientName: string | null;
            patientId: string;
          }>
        >`
        SELECT i."totalAmount"::text, i."createdAt", p."fullName" AS "patientName", i."patientId"
        FROM "Invoice" i
        LEFT JOIN "Appointment" a ON a.id = i."appointmentId"
        LEFT JOIN "Patient" p ON p.id = i."patientId"
        WHERE i."clinicId" = ${user.clinicId}
          AND (
            a."doctorId" = ${user.userId}
            OR (i."appointmentId" IS NULL AND i."issuedById" = ${user.userId})
          )
          AND i."createdAt" >= ${startOfMonth}
          AND i."createdAt" < ${startOfNextMonth}
        ORDER BY i."createdAt" DESC
      `,
        this.prisma.$queryRaw<Array<{ totalAmount: string }>>`
        SELECT i."totalAmount"::text
        FROM "Invoice" i
        LEFT JOIN "Appointment" a ON a.id = i."appointmentId"
        WHERE i."clinicId" = ${user.clinicId}
          AND (
            a."doctorId" = ${user.userId}
            OR (i."appointmentId" IS NULL AND i."issuedById" = ${user.userId})
          )
          AND i."createdAt" >= ${startOfPrevMonth}
          AND i."createdAt" < ${startOfMonth}
      `,
        this.prisma.$queryRaw<
          Array<{
            total: bigint;
            completed: bigint;
            inQueue: bigint;
            inProgress: bigint;
          }>
        >`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
          COUNT(*) FILTER (WHERE status = 'IN_QUEUE') AS "inQueue",
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS "inProgress"
        FROM "Appointment"
        WHERE "clinicId" = ${user.clinicId}
          AND "doctorId" = ${user.userId}
          AND "startsAt" >= ${startOfDay}
          AND "startsAt" < ${endOfDay}
      `,
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "patientId") AS count
        FROM "Appointment"
        WHERE "clinicId" = ${user.clinicId} AND "doctorId" = ${user.userId}
      `,
      ]);

    const policy = adminRow[0];
    const adminPolicy = policy?.paymentMode ?? null;
    const adminFixed = Number(policy?.fixedMonthlyRent ?? 0);
    const adminPct = Number(policy?.adminPercentage ?? 0);
    const monthlyGross = invoices.reduce(
      (s, r) => s + Number(r.totalAmount),
      0,
    );
    const prevGross = prevInvoices.reduce(
      (s, r) => s + Number(r.totalAmount),
      0,
    );

    const perVisitDeduction = (gross: number) =>
      adminPolicy === "PERCENTAGE" ? gross * (adminPct / 100) : 0;
    const monthlyDeduction =
      adminPolicy === "FIXED_RENT"
        ? adminFixed
        : invoices.reduce(
            (s, r) => s + perVisitDeduction(Number(r.totalAmount)),
            0,
          );

    const monthlyNet = monthlyGross - monthlyDeduction;
    const prevNet =
      prevGross -
      (adminPolicy === "FIXED_RENT"
        ? adminFixed
        : prevInvoices.reduce(
            (s, r) => s + perVisitDeduction(Number(r.totalAmount)),
            0,
          ));

    const today = todayStats[0] ?? {
      total: 0n,
      completed: 0n,
      inQueue: 0n,
      inProgress: 0n,
    };

    // Daily breakdown for chart (current month)
    const dailyMap: Record<number, { gross: number; net: number }> = {};
    for (const r of invoices) {
      const day = new Date(r.createdAt).getDate();
      if (!dailyMap[day]) dailyMap[day] = { gross: 0, net: 0 };
      const g = Number(r.totalAmount);
      dailyMap[day].gross += g;
      dailyMap[day].net += g - perVisitDeduction(g);
    }
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const dailyChart = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      gross: dailyMap[i + 1]?.gross ?? 0,
      net: dailyMap[i + 1]?.net ?? 0,
    }));

    return {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      monthlyGross,
      monthlyDeduction,
      monthlyNet,
      prevMonthNet: prevNet,
      netChangePercent:
        prevNet > 0
          ? Math.round(((monthlyNet - prevNet) / prevNet) * 100)
          : null,
      todayTotal: Number(today.total),
      todayCompleted: Number(today.completed),
      todayInQueue: Number(today.inQueue),
      todayInProgress: Number(today.inProgress),
      totalPatients: Number(allPatients[0]?.count ?? 0),
      paymentMode: adminPolicy,
      adminFixed,
      adminPct,
      recentInvoices: invoices.slice(0, 10).map((r) => ({
        patientName: r.patientName ?? "—",
        gross: Number(r.totalAmount),
        net: Number(r.totalAmount) - perVisitDeduction(Number(r.totalAmount)),
        deducted: perVisitDeduction(Number(r.totalAmount)),
        createdAt: r.createdAt,
      })),
      dailyChart,
    };
  }

  async create(user: RequestUser, dto: CreateInvoiceDto) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");

    await this.ensurePatientInClinic(user.clinicId, dto.patientId);

    if (dto.appointmentId) {
      const appointmentWhere: any = {
        id: dto.appointmentId,
        clinicId: user.clinicId,
        patientId: dto.patientId,
      };
      // DOCTOR and DOCTOR_ADMIN can only invoice their own appointments
      if (user.role === ClinicRole.DOCTOR_ADMIN) {
        appointmentWhere.doctorId = user.userId;
      }
      const appointment = await this.prisma.appointment.findFirst({
        where: appointmentWhere,
      });
      if (!appointment) throw new NotFoundException("Appointment not found");
    }

    const id = randomUUID();
    const totalAmount = dto.services.reduce(
      (sum, line) => sum + Number(line.amount || 0),
      0,
    );
    const paidAmount = Math.min(
      Number(dto.paidAmount ?? totalAmount),
      totalAmount,
    );
    const status =
      paidAmount >= totalAmount
        ? "PAID"
        : paidAmount > 0
          ? "PARTIAL"
          : "UNPAID";
    const services = JSON.stringify(dto.services);
    const notes = dto.notes ?? null;

    const rows = await this.prisma.$queryRaw<InvoiceRow[]>`
      INSERT INTO "Invoice" (
        "id", "clinicId", "patientId", "appointmentId", "issuedById",
        "totalAmount", "paidAmount", "paymentMethod", "status", "notes", "services", "updatedAt"
      )
      VALUES (
        ${id}, ${user.clinicId}, ${dto.patientId}, ${dto.appointmentId ?? null}, ${user.userId},
        ${totalAmount}, ${paidAmount}, ${dto.paymentMethod}, ${status}, ${notes}, ${services}::jsonb, NOW()
      )
      RETURNING *
    `;

    await this.prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        actorId: user.userId,
        action: "INVOICE_CREATED",
        entityType: "Invoice",
        entityId: id,
        meta: {
          patientId: dto.patientId,
          appointmentId: dto.appointmentId ?? null,
          totalAmount,
        },
      },
    });

    return this.getInvoice(user.clinicId, rows[0].id);
  }

  async update(user: RequestUser, invoiceId: string, dto: UpdateInvoiceDto) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");

    const existing = await this.getInvoice(user.clinicId, invoiceId);
    if (!existing) throw new NotFoundException("Invoice not found");

    // DOCTOR and DOCTOR_ADMIN can only edit their own invoices
    if (
      user.role === ClinicRole.DOCTOR_ADMIN &&
      existing.issuedById !== user.userId
    ) {
      throw new ForbiddenException("Cannot edit another doctor's invoice");
    }

    const patientId = dto.patientId ?? existing.patientId;
    const paymentMethod = dto.paymentMethod ?? existing.paymentMethod;
    const servicesValue = dto.services ?? (existing.services as any);
    await this.ensurePatientInClinic(user.clinicId, patientId);

    const totalAmount = Array.isArray(servicesValue)
      ? servicesValue.reduce((sum, line) => sum + Number(line.amount || 0), 0)
      : Number(existing.totalAmount);
    const services = JSON.stringify(servicesValue);

    await this.prisma.$queryRaw<InvoiceRow[]>`
      UPDATE "Invoice"
      SET
        "patientId" = ${patientId},
        "paymentMethod" = ${paymentMethod},
        "services" = ${services}::jsonb,
        "totalAmount" = ${totalAmount}
      WHERE "id" = ${invoiceId} AND "clinicId" = ${user.clinicId}
      RETURNING *
    `;

    await this.prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        actorId: user.userId,
        action: "INVOICE_UPDATED",
        entityType: "Invoice",
        entityId: invoiceId,
        meta: { patientId, totalAmount },
      },
    });

    return this.getInvoice(user.clinicId, invoiceId);
  }

  async delete(user: RequestUser, invoiceId: string) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");

    const existing = await this.getInvoice(user.clinicId, invoiceId);
    if (!existing) throw new NotFoundException("Invoice not found");

    // DOCTOR and DOCTOR_ADMIN can only delete their own invoices
    if (
      user.role === ClinicRole.DOCTOR_ADMIN &&
      existing.issuedById !== user.userId
    ) {
      throw new ForbiddenException("Cannot delete another doctor's invoice");
    }

    await this.prisma.$queryRaw<InvoiceRow[]>`
      DELETE FROM "Invoice"
      WHERE "id" = ${invoiceId} AND "clinicId" = ${user.clinicId}
      RETURNING *
    `;

    await this.prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        actorId: user.userId,
        action: "INVOICE_DELETED",
        entityType: "Invoice",
        entityId: invoiceId,
        meta: {
          patientId: existing.patientId,
          totalAmount: existing.totalAmount,
        },
      },
    });

    return existing;
  }

  private async ensurePatientInClinic(clinicId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, clinicId },
    });
    if (!patient) throw new NotFoundException("Patient not found");
  }

  private async getInvoice(clinicId: string, invoiceId: string) {
    const rows = await this.prisma.$queryRaw<InvoiceView[]>`
      SELECT
        i.*,
        json_build_object('id', p.id, 'code', p.code, 'fullName', p."fullName") AS patient
      FROM "Invoice" i
      LEFT JOIN "Patient" p ON p.id = i."patientId"
      WHERE i."clinicId" = ${clinicId} AND i.id = ${invoiceId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }
}
