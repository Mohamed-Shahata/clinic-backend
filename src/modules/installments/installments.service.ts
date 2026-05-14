import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";
import { InstallmentStatus } from "@prisma/client";

export interface CreateInstallmentDto {
  patientId: string;
  appointmentId?: string;
  title: string;
  totalAmount: number;
  initialPayment?: number;
  notes?: string;
}

export interface AddPaymentDto {
  amount: number;
  note?: string;
}

@Injectable()
export class InstallmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(clinicId: string, userId: string, dto: CreateInstallmentDto) {
    const { patientId, appointmentId, title, totalAmount, initialPayment = 0, notes } = dto;

    if (totalAmount <= 0) throw new BadRequestException("totalAmount must be > 0");
    if (initialPayment < 0 || initialPayment > totalAmount)
      throw new BadRequestException("initialPayment out of range");

    const status: InstallmentStatus =
      initialPayment >= totalAmount
        ? "PAID"
        : initialPayment > 0
          ? "PARTIAL"
          : "PENDING";

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.installmentPlan.create({
        data: {
          clinicId,
          patientId,
          appointmentId: appointmentId ?? null,
          createdById: userId,
          title,
          totalAmount,
          paidAmount: initialPayment,
          status,
          notes: notes ?? null,
        },
      });

      if (initialPayment > 0) {
        await tx.installmentPayment.create({
          data: {
            planId: plan.id,
            amount: initialPayment,
            note: "دفعة أولى",
            recordedBy: userId,
          },
        });
      }

      return plan;
    });
  }

  async findByClinic(clinicId: string, patientId?: string, status?: string) {
    return this.prisma.installmentPlan.findMany({
      where: {
        clinicId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status: status as InstallmentStatus } : {}),
      },
      include: {
        patient: { select: { id: true, fullName: true, code: true, phone: true } },
        payments: { orderBy: { paidAt: "desc" } },
        appointment: { select: { id: true, startsAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(clinicId: string, planId: string) {
    const plan = await this.prisma.installmentPlan.findFirst({
      where: { id: planId, clinicId },
      include: {
        patient: { select: { id: true, fullName: true, code: true, phone: true } },
        payments: { orderBy: { paidAt: "asc" } },
        appointment: { select: { id: true, startsAt: true } },
      },
    });
    if (!plan) throw new NotFoundException("Installment plan not found");
    return plan;
  }

  async addPayment(clinicId: string, userId: string, planId: string, dto: AddPaymentDto) {
    const plan = await this.prisma.installmentPlan.findFirst({
      where: { id: planId, clinicId },
    });
    if (!plan) throw new NotFoundException("Installment plan not found");
    if (plan.status === "PAID") throw new BadRequestException("Plan already fully paid");
    if (dto.amount <= 0) throw new BadRequestException("amount must be > 0");

    const newPaid = Number(plan.paidAmount) + dto.amount;
    const newStatus: InstallmentStatus =
      newPaid >= Number(plan.totalAmount) ? "PAID" : "PARTIAL";

    return this.prisma.$transaction(async (tx) => {
      await tx.installmentPayment.create({
        data: {
          planId,
          amount: Math.min(dto.amount, Number(plan.totalAmount) - Number(plan.paidAmount)),
          note: dto.note ?? null,
          recordedBy: userId,
        },
      });

      return tx.installmentPlan.update({
        where: { id: planId },
        data: {
          paidAmount: Math.min(newPaid, Number(plan.totalAmount)),
          status: newStatus,
          updatedAt: new Date(),
        },
        include: {
          patient: { select: { id: true, fullName: true, code: true } },
          payments: { orderBy: { paidAt: "asc" } },
        },
      });
    });
  }

  async delete(clinicId: string, planId: string) {
    const plan = await this.prisma.installmentPlan.findFirst({
      where: { id: planId, clinicId },
    });
    if (!plan) throw new NotFoundException("Installment plan not found");
    await this.prisma.installmentPlan.delete({ where: { id: planId } });
    return { ok: true };
  }
}
