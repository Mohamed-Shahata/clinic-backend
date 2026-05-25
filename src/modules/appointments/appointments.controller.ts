import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ClinicRole } from "@prisma/client";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { Roles } from "../../core/auth/decorators/roles.decorator";
import { Permissions } from "../../core/auth/rbac/permissions.decorator";
import { Permission } from "../../core/auth/rbac/role-permissions";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { AppointmentsService } from "./appointments.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";
import { UpdateAppointmentStatusDto } from "./dto/update-appointment-status.dto";

@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.VIEW_SCHEDULE, Permission.VIEW_OWN_SCHEDULE)
  list(
    @CurrentUser() user: RequestUser,
    @Query("doctorId") doctorId?: string,
    @Query("date") date?: string,
    @Query("status") status?: string,
  ) {
    return this.appointmentsService.list(user, doctorId, date, status);
  }

  @Get("queue")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.VIEW_QUEUE, Permission.VIEW_SCHEDULE)
  queue(@CurrentUser() user: RequestUser) {
    return this.appointmentsService.queue(user);
  }

  @Post()
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.CREATE_APPOINTMENT)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAppointmentDto) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");
    return this.appointmentsService.create(user.clinicId, dto, user.userId);
  }

  @Patch(":appointmentId")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.UPDATE_APPOINTMENT)
  update(
    @CurrentUser() user: RequestUser,
    @Param("appointmentId") appointmentId: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");
    return this.appointmentsService.update(
      user.clinicId,
      appointmentId,
      dto,
      user,
    );
  }

  @Patch(":appointmentId/status")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.UPDATE_APPOINTMENT, Permission.CREATE_PRESCRIPTION)
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param("appointmentId") appointmentId: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");
    return this.appointmentsService.updateStatus(
      user.clinicId,
      appointmentId,
      dto.status,
      user,
    );
  }

  @Delete(":appointmentId")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  @Permissions(Permission.CANCEL_APPOINTMENT)
  delete(
    @CurrentUser() user: RequestUser,
    @Param("appointmentId") appointmentId: string,
  ) {
    if (!user.clinicId) throw new ForbiddenException("Clinic context required");
    return this.appointmentsService.delete(
      user.clinicId,
      appointmentId,
      user.userId,
    );
  }
}
