import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { ClinicRole } from "@prisma/client";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { Public } from "../../core/auth/decorators/public.decorator";
import { Roles } from "../../core/auth/decorators/roles.decorator";
import { Permissions } from "../../core/auth/rbac/permissions.decorator";
import { Permission } from "../../core/auth/rbac/role-permissions";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { BillingService } from "./billing.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import {
  CreatePublicSubscriptionPaymentRequestDto,
  CreateSubscriptionPaymentRequestDto,
} from "./dto/create-subscription-payment-request.dto";
import { CreateSubscriptionPlanDto } from "./dto/create-subscription-plan.dto";
import { ReviewSubscriptionPaymentRequestDto } from "./dto/review-subscription-payment-request.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { UpdateSubscriptionPlanDto } from "./dto/update-subscription-plan.dto";

@Controller("billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post("extend-subscription")
  @Permissions(Permission.CREATE_CLINIC)
  extendSubscription(
    @CurrentUser() user: RequestUser,
    @Body() dto: { clinicId?: string; days: number; reason?: string },
  ) {
    return this.billingService.extendSubscription(user, dto);
  }

  @Get("subscription-plans")
  @Public()
  listSubscriptionPlans() {
    return this.billingService.listSubscriptionPlans();
  }

  @Get("subscription-plans/manage")
  @Permissions(Permission.CREATE_CLINIC)
  listSubscriptionPlansManage() {
    return this.billingService.listSubscriptionPlansManage();
  }

  @Post("subscription-plans")
  @Permissions(Permission.CREATE_CLINIC)
  createSubscriptionPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.billingService.createSubscriptionPlan(dto);
  }

  @Patch("subscription-plans/manage/:planId")
  @Permissions(Permission.CREATE_CLINIC)
  updateSubscriptionPlanManage(
    @Param("planId") planId: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.billingService.updateSubscriptionPlan(planId, dto);
  }

  @Delete("subscription-plans/manage/:planId")
  @Permissions(Permission.CREATE_CLINIC)
  deleteSubscriptionPlan(@Param("planId") planId: string) {
    return this.billingService.deleteSubscriptionPlan(planId);
  }

  @Patch("subscription-plans/:planId")
  @Permissions(Permission.CREATE_CLINIC)
  updateSubscriptionPlan(
    @Param("planId") planId: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.billingService.updateSubscriptionPlan(planId, dto);
  }

  @Get("subscription")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.VIEW_CLINIC_FINANCIALS)
  getSubscription(@CurrentUser() user: RequestUser) {
    return this.billingService.getCurrentSubscription(user);
  }

  @Post("subscription-requests")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.VIEW_CLINIC_FINANCIALS)
  createSubscriptionRequest(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSubscriptionPaymentRequestDto,
  ) {
    return this.billingService.createSubscriptionPaymentRequest(user, dto);
  }

  @Public()
  @Post("public/subscription-requests")
  createPublicSubscriptionRequest(
    @Body() dto: CreatePublicSubscriptionPaymentRequestDto,
  ) {
    return this.billingService.createPublicSubscriptionPaymentRequest(dto);
  }

  @Get("subscription-requests")
  @Permissions(Permission.VIEW_PLATFORM_STATS)
  listSubscriptionRequests(
    @Query("status") status?: "PENDING" | "APPROVED" | "REJECTED",
  ) {
    return this.billingService.listSubscriptionPaymentRequests(status);
  }

  @Patch("subscription-requests/:requestId/review")
  @Permissions(Permission.UPDATE_CLINIC_STATUS)
  reviewSubscriptionRequest(
    @CurrentUser() user: RequestUser,
    @Param("requestId") requestId: string,
    @Body() dto: ReviewSubscriptionPaymentRequestDto,
  ) {
    return this.billingService.reviewSubscriptionPaymentRequest(
      requestId,
      user,
      dto,
    );
  }

  @Get("invoices")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.VIEW_BILLING, Permission.VIEW_CLINIC_FINANCIALS)
  list(
    @CurrentUser() user: RequestUser,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.billingService.list(user, cursor, limit ? Number(limit) : 50);
  }

  @Get("invoices/export/csv")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.EXPORT_CLINIC_DATA)
  async exportInvoicesCsv(
    @CurrentUser() user: RequestUser,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.billingService.exportInvoicesCsv(user, from, to);
    // FIX: Stream CSV with attachment headers for clinic-scoped invoice export.
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="invoices.csv"');
    res.send(csv);
  }

  @Get("doctor-monthly-stats")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR)
  doctorMonthlyStats(@CurrentUser() user: RequestUser) {
    return this.billingService.doctorMonthlyStats(user);
  }

  @Get("doctor-earnings")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  doctorEarnings(@CurrentUser() user: RequestUser) {
    return this.billingService.doctorEarnings(user);
  }

  @Post("invoices")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.CREATE_INVOICE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateInvoiceDto) {
    return this.billingService.create(user, dto);
  }

  @Patch("invoices/:invoiceId")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.UPDATE_INVOICE)
  update(
    @CurrentUser() user: RequestUser,
    @Param("invoiceId") invoiceId: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.billingService.update(user, invoiceId, dto);
  }

  @Delete("invoices/:invoiceId")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.DELETE_INVOICE)
  delete(
    @CurrentUser() user: RequestUser,
    @Param("invoiceId") invoiceId: string,
  ) {
    return this.billingService.delete(user, invoiceId);
  }

  // ──────────────────────────────────────────────
  // SETTLEMENT ENDPOINTS
  // ──────────────────────────────────────────────

  @Get("settlements")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  listSettlements(
    @CurrentUser() user: RequestUser,
    @Query("month") month?: string,
  ) {
    return this.billingService.listSettlements(user, month);
  }

  @Post("settlements/:doctorUserId")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.MANAGE_CLINIC_STAFF)
  createOrUpdateSettlement(
    @CurrentUser() user: RequestUser,
    @Param("doctorUserId") doctorUserId: string,
    @Body()
    dto: {
      month: string;
      status: "PENDING" | "PAID" | "PARTIAL";
      paidAmount?: number;
      paymentMethod?: string;
      notes?: string;
    },
  ) {
    return this.billingService.createOrUpdateSettlement(
      user,
      doctorUserId,
      dto.month,
      dto,
    );
  }
}
