import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ClinicRole } from "@prisma/client";
import { RolesGuard } from "../../core/auth/guards/roles.guard";
import { Roles } from "../../core/auth/decorators/roles.decorator";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { SalariesService } from "./salaries.service";

@Controller("salaries")
@UseGuards(RolesGuard)
@Roles(ClinicRole.DOCTOR_ADMIN) // ← كل الـ endpoints محمية بـ DOCTOR_ADMIN
export class SalariesController {
  constructor(private readonly svc: SalariesService) {}

  /** تحديد/تعديل راتب سكيرتيرة */
  @Post("staff/:clinicUserId")
  setSalary(
    @CurrentUser() user: RequestUser,
    @Param("clinicUserId") clinicUserId: string,
    @Body("monthlyAmount") monthlyAmount: number,
  ) {
    if (!user.clinicId) throw new Error("No clinic");
    return this.svc.setSalary(
      user.clinicId,
      clinicUserId,
      Number(monthlyAmount),
    );
  }

  /** overview الرواتب للدكتور */
  @Get("overview")
  overview(@CurrentUser() user: RequestUser) {
    if (!user.clinicId) throw new Error("No clinic");
    return this.svc.getSalaryOverview(user.clinicId);
  }

  /** صرف راتب */
  @Post(":salaryId/pay")
  pay(
    @CurrentUser() user: RequestUser,
    @Param("salaryId") salaryId: string,
    @Body("amount") amount: number,
    @Body("note") note?: string,
  ) {
    if (!user.clinicId) throw new Error("No clinic");
    return this.svc.paysalary(
      user.clinicId,
      user.userId,
      salaryId,
      Number(amount),
      note,
    );
  }

  /** تاريخ صرف */
  @Get(":salaryId/history")
  history(
    @CurrentUser() user: RequestUser,
    @Param("salaryId") salaryId: string,
  ) {
    if (!user.clinicId) throw new Error("No clinic");
    return this.svc.getPaymentHistory(user.clinicId, salaryId);
  }
}
