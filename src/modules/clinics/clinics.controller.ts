import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { RbacService } from "../../core/auth/rbac/rbac.service";
import { Permission } from "../../core/auth/rbac/role-permissions";
import { Permissions } from "../../core/auth/rbac/permissions.decorator";
import { RolesGuard } from "../../core/auth/guards/roles.guard";
import { SuperAdminGuard } from "../../core/auth/guards/role-specific.guard";
import { CreateClinicDto } from "./dto/create-clinic.dto";
import { UpdateClinicSettingsDto } from "./dto/update-clinic-settings.dto";
import { ClinicsService } from "./clinics.service";
import { ClinicRole } from "@prisma/client";
import { Roles } from "../../core/auth/decorators/roles.decorator";

@Controller("clinics")
export class ClinicsController {
  constructor(
    private readonly clinicsService: ClinicsService,
    private readonly rbacService: RbacService,
  ) {}

  private requireSuperAdmin(user: RequestUser) {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException("Super admin access required");
    }
  }

  @Get()
  @Permissions(Permission.CREATE_CLINIC)
  async listAll(@CurrentUser() user: RequestUser) {
    this.requireSuperAdmin(user);
    return this.clinicsService.listAll();
  }

  @Post()
  @Permissions(Permission.CREATE_CLINIC)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateClinicDto) {
    this.requireSuperAdmin(user);
    return this.clinicsService.create(dto, user.userId);
  }

  @Get("stats")
  @Permissions(Permission.VIEW_PLATFORM_STATS)
  async stats(@CurrentUser() user: RequestUser) {
    this.requireSuperAdmin(user);
    return this.clinicsService.getStats();
  }

  @Patch(":clinicId/status")
  @Permissions(Permission.UPDATE_CLINIC_STATUS)
  async updateClinicStatus(
    @CurrentUser() user: RequestUser,
    @Param("clinicId") clinicId: string,
    @Body() body: { isActive: boolean },
  ) {
    this.requireSuperAdmin(user);
    return this.clinicsService.updateClinicStatus(
      clinicId,
      body.isActive,
      user.userId,
    );
  }

  @Delete(":clinicId")
  @Permissions(Permission.UPDATE_CLINIC_STATUS)
  async deleteClinic(
    @CurrentUser() user: RequestUser,
    @Param("clinicId") clinicId: string,
  ) {
    this.requireSuperAdmin(user);
    return this.clinicsService.deleteClinic(clinicId, user.userId);
  }

  @Get(":clinicId")
  @UseGuards(RolesGuard)
  async getClinic(
    @CurrentUser() user: RequestUser,
    @Param("clinicId") clinicId: string,
  ) {
    // Super admin can access any clinic, clinic admin can access their own
    if (!user.isSuperAdmin && user.clinicId !== clinicId) {
      throw new ForbiddenException("Cannot access this clinic");
    }
    return this.clinicsService.getById(clinicId);
  }

  @Get(":clinicId/directory-details")
  @Permissions(Permission.CREATE_CLINIC)
  async directoryDetails(
    @CurrentUser() user: RequestUser,
    @Param("clinicId") clinicId: string,
  ) {
    this.requireSuperAdmin(user);
    return this.clinicsService.getDirectoryDetails(clinicId);
  }

  @Patch("settings")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.UPDATE_CLINIC_SETTINGS)
  async updateSettings(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateClinicSettingsDto,
  ) {
    if (!user.clinicId) {
      throw new ForbiddenException("Clinic context required");
    }
    return this.clinicsService.updateSettings(user.clinicId, dto, user.userId);
  }
}
