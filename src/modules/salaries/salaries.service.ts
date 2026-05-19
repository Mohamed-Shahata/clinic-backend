import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";

@Injectable()
export class SalariesService {
  private readonly logger = new Logger(SalariesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async setSalary(
    clinicId: string,
    clinicUserId: string,
    monthlyAmount: number,
  ) {
    if (monthlyAmount <= 0)
      throw new BadRequestException("monthlyAmount must be > 0");

    // ── تحقق إن الـ clinicUser موجود فعلاً في هذه العيادة ──────────────
    const cu = await this.prisma.clinicUser.findFirst({
      where: { id: clinicUserId, clinicId, role: "RECEPTIONIST" },
    });
    if (!cu)
      throw new NotFoundException(
        `Receptionist ${clinicUserId} not found in clinic ${clinicId}`,
      );

    await this.prisma.staffSalary.updateMany({
      where: { clinicId, clinicUserId, isActive: true },
      data: { isActive: false },
    });

    return this.prisma.staffSalary.create({
      data: {
        clinicId,
        clinicUserId,
        monthlyAmount,
        effectiveFrom: new Date(),
        isActive: true,
      },
    });
  }

  async getSalaryOverview(clinicId: string) {
    // ── جلب كل السكيرتيرات النشطات في العيادة ──────────────────────────
    const receptionists = await this.prisma.clinicUser.findMany({
      where: { clinicId, role: "RECEPTIONIST", isActive: true },
      include: {
        user: { select: { fullName: true, id: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    this.logger.debug(
      `getSalaryOverview: clinicId=${clinicId} → found ${receptionists.length} receptionists`,
    );

    if (receptionists.length === 0) return [];

    const results = await Promise.all(
      receptionists.map(async (cu) => {
        const salary = await this.prisma.staffSalary.findFirst({
          where: { clinicId, clinicUserId: cu.id, isActive: true },
          orderBy: { effectiveFrom: "desc" },
        });

        const lastPayment = salary
          ? await this.prisma.salaryPayment.findFirst({
              where: { salaryId: salary.id },
              orderBy: { paidAt: "desc" },
            })
          : null;

        let accrued = 0;
        let dailyRate = 0;

        if (salary) {
          dailyRate = Number(salary.monthlyAmount) / 30;
          const from = lastPayment
            ? new Date(lastPayment.paidAt)
            : new Date(salary.effectiveFrom);
          const days = Math.max(
            0,
            Math.floor((Date.now() - from.getTime()) / 86_400_000),
          );
          accrued = Math.round(dailyRate * days * 100) / 100;
        }

        return {
          clinicUserId: cu.id, // ← ده الـ ClinicUser.id مش User.id
          userId: cu.userId,
          fullName: cu.user.fullName,
          monthlyAmount: salary ? Number(salary.monthlyAmount) : null,
          dailyRate: Math.round(dailyRate * 100) / 100,
          accrued,
          lastPaidAt: lastPayment?.paidAt ?? null,
          lastPaidAmount: lastPayment ? Number(lastPayment.amount) : null,
          salaryId: salary?.id ?? null,
          effectiveFrom: salary?.effectiveFrom ?? null,
        };
      }),
    );

    return results;
  }

  async paysalary(
    clinicId: string,
    doctorId: string,
    salaryId: string,
    amount: number,
    note?: string,
  ) {
    const salary = await this.prisma.staffSalary.findFirst({
      where: { id: salaryId, clinicId, isActive: true },
    });
    if (!salary) throw new NotFoundException("Salary record not found");
    if (amount <= 0) throw new BadRequestException("amount must be > 0");

    return this.prisma.salaryPayment.create({
      data: {
        salaryId,
        clinicId,
        amount,
        paidById: doctorId,
        note: note ?? null,
      },
    });
  }

  async getPaymentHistory(clinicId: string, salaryId: string) {
    const salary = await this.prisma.staffSalary.findFirst({
      where: { id: salaryId, clinicId },
    });
    if (!salary) throw new NotFoundException("Salary not found");

    return this.prisma.salaryPayment.findMany({
      where: { salaryId },
      orderBy: { paidAt: "desc" },
    });
  }
}
