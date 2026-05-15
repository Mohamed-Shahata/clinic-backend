import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ClinicRole } from "@prisma/client";
import { RolesGuard } from "../../core/auth/guards/roles.guard";
import { Roles } from "../../core/auth/decorators/roles.decorator";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { RequestUser } from "../../core/auth/types/request-user.type";
import {
  InstallmentsService,
  CreateInstallmentDto,
  AddPaymentDto,
} from "./installments.service";
import { ForbiddenException } from "@nestjs/common";

@Controller("installments")
@UseGuards(RolesGuard)
@Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.RECEPTIONIST)
export class InstallmentsController {
  constructor(private readonly svc: InstallmentsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateInstallmentDto) {
    if (!user.clinicId) throw new ForbiddenException("No clinic context");
    return this.svc.create(user.clinicId, user.userId, dto);
  }

  @Get()
  @SkipThrottle()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("patientId") patientId?: string,
    @Query("status") status?: string,
  ) {
    if (!user.clinicId) throw new ForbiddenException("No clinic context");
    return this.svc.findByClinic(user.clinicId, patientId, status);
  }

  @Get(":id")
  @SkipThrottle()
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    if (!user.clinicId) throw new ForbiddenException("No clinic context");
    return this.svc.findOne(user.clinicId, id);
  }

  @Post(":id/payments")
  addPayment(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: AddPaymentDto,
  ) {
    if (!user.clinicId) throw new ForbiddenException("No clinic context");
    return this.svc.addPayment(user.clinicId, user.userId, id, dto);
  }

  @Delete(":id")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  delete(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    if (!user.clinicId) throw new ForbiddenException("No clinic context");
    return this.svc.delete(user.clinicId, id);
  }
}
