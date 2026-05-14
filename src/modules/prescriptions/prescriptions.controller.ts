import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { ClinicRole } from "@prisma/client";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { Roles } from "../../core/auth/decorators/roles.decorator";
import { Permissions } from "../../core/auth/rbac/permissions.decorator";
import { Permission } from "../../core/auth/rbac/role-permissions";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";
import {
  CreateMedicationCatalogDto,
  UpdateMedicationCatalogDto,
  CreateImagingCatalogDto,
  UpdateImagingCatalogDto,
} from "./dto/catalog.dto";
import { PrescriptionsService } from "./prescriptions.service";

class SaveTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsObject()
  header?: object;

  @IsOptional()
  @IsObject()
  footer?: object;
}

@Controller("prescriptions")
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Get("patient/:patientId")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.VIEW_PATIENT_HISTORY)
  listByPatient(@CurrentUser() user: RequestUser, @Param("patientId") patientId: string) {
    return this.prescriptionsService.listByPatient(user, patientId);
  }

  @Post()
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.CREATE_PRESCRIPTION)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePrescriptionDto) {
    return this.prescriptionsService.create(user, dto);
  }

  @Get("catalog/medications")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  listMedications(@CurrentUser() user: RequestUser, @Query("q") q?: string) {
    return this.prescriptionsService.listMedicationCatalog(user, q);
  }

  @Post("catalog/medications")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  createMedication(@CurrentUser() user: RequestUser, @Body() dto: CreateMedicationCatalogDto) {
    return this.prescriptionsService.createMedicationCatalog(user, dto);
  }

  @Patch("catalog/medications/:id")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  updateMedication(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateMedicationCatalogDto) {
    return this.prescriptionsService.updateMedicationCatalog(user, id, dto);
  }

  @Delete("catalog/medications/:id")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  deleteMedication(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.prescriptionsService.deleteMedicationCatalog(user, id);
  }

  @Get("catalog/imaging")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  listImaging(@CurrentUser() user: RequestUser, @Query("q") q?: string) {
    return this.prescriptionsService.listImagingCatalog(user, q);
  }

  @Post("catalog/imaging")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  createImaging(@CurrentUser() user: RequestUser, @Body() dto: CreateImagingCatalogDto) {
    return this.prescriptionsService.createImagingCatalog(user, dto);
  }

  @Patch("catalog/imaging/:id")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  updateImaging(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateImagingCatalogDto) {
    return this.prescriptionsService.updateImagingCatalog(user, id, dto);
  }

  @Delete("catalog/imaging/:id")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  deleteImaging(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.prescriptionsService.deleteImagingCatalog(user, id);
  }

  @Get("template")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  getTemplate(@CurrentUser() user: RequestUser) {
    return this.prescriptionsService.getPrescriptionTemplate(user);
  }

  @Post("template")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  saveTemplate(@CurrentUser() user: RequestUser, @Body() dto: SaveTemplateDto) {
    return this.prescriptionsService.savePrescriptionTemplate(user, dto);
  }
}
