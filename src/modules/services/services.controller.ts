import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ClinicRole } from "@prisma/client";
import { RolesGuard } from "../../core/auth/guards/roles.guard";
import { Roles } from "../../core/auth/decorators/roles.decorator";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { ServicesService, CreateServiceDto } from "./services.service";

@Controller("services")
@UseGuards(RolesGuard)
export class ServicesController {
  constructor(private readonly svc: ServicesService) {}

  // Both roles can view the service catalog (needed when creating invoices)
  @Get()
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR, ClinicRole.RECEPTIONIST)
  findAll(@CurrentUser() u: RequestUser) {
    return this.svc.findAll(u.clinicId!);
  }

  // Only DOCTOR_ADMIN can manage the catalog
  @Post()
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR)
  create(@CurrentUser() u: RequestUser, @Body() dto: CreateServiceDto) {
    return this.svc.create(u.clinicId!, dto);
  }

  @Patch(":id")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR)
  update(
    @CurrentUser() u: RequestUser,
    @Param("id") id: string,
    @Body() dto: Partial<CreateServiceDto>,
  ) {
    return this.svc.update(u.clinicId!, id, dto);
  }

  @Delete(":id")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.DOCTOR)
  remove(@CurrentUser() u: RequestUser, @Param("id") id: string) {
    return this.svc.remove(u.clinicId!, id);
  }
}
