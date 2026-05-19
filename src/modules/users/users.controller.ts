import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Delete,
  Post,
  Patch,
  Param,
  UseGuards,
  Query,
} from "@nestjs/common";
import { ClinicRole } from "@prisma/client";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { Roles } from "../../core/auth/decorators/roles.decorator";
import { RolesGuard } from "../../core/auth/guards/roles.guard";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { RbacService } from "../../core/auth/rbac/rbac.service";
import { Permission } from "../../core/auth/rbac/role-permissions";
import { Permissions } from "../../core/auth/rbac/permissions.decorator";
import { CreateClinicDoctorDto } from "./dto/create-clinic-doctor.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateDoctorPaymentDto } from "./dto/update-doctor-payment.dto";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rbacService: RbacService,
  ) {}

  private requireSuperAdmin(user: RequestUser) {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException("Super admin access required");
    }
  }

  @Get("platform-directory")
  @Permissions(Permission.MANAGE_PLATFORM_USERS)
  async platformDirectory(
    @CurrentUser() user: RequestUser,
    @Query("role") role?: ClinicRole,
    @Query("clinicId") clinicId?: string,
    @Query("q") q?: string,
  ) {
    this.requireSuperAdmin(user);
    return this.usersService.listPlatformDirectory({ role, clinicId, q });
  }


  @Get("doctors")
  @Roles(ClinicRole.DOCTOR_ADMIN, ClinicRole.RECEPTIONIST)
  async listDoctors(@CurrentUser() user: RequestUser) {
    if (!user.clinicId) {
      throw new ForbiddenException("Clinic context required");
    }
    return this.usersService.listClinicDoctors(user.clinicId);
  }

  @Post("doctors")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.MANAGE_CLINIC_STAFF)
  async createDoctor(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateClinicDoctorDto,
  ) {
    if (!user.clinicId) {
      throw new ForbiddenException("Clinic context required");
    }
    return this.usersService.createDoctor(user.clinicId, dto, user.userId);
  }

  @Post("receptionists")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.CREATE_RECEPTIONIST)
  async createReceptionist(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateClinicDoctorDto,
  ) {
    if (!user.clinicId) {
      throw new ForbiddenException("Clinic context required");
    }
    return this.usersService.createReceptionist(user.clinicId, dto, user.userId);
  }

  @Get("receptionists")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  async listReceptionists(@CurrentUser() user: RequestUser) {
    if (!user.clinicId) {
      throw new ForbiddenException("Clinic context required");
    }
    return this.usersService.listReceptionists(user.clinicId);
  }

  @Get("staff")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  async listStaff(@CurrentUser() user: RequestUser) {
    if (!user.clinicId) {
      throw new ForbiddenException("Clinic context required");
    }
    return this.usersService.listClinicStaff(user.clinicId);
  }

  @Get("staff/:userId")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  async staffDetails(
    @CurrentUser() user: RequestUser,
    @Param("userId") userId: string,
  ) {
    if (!user.clinicId) {
      throw new ForbiddenException("Clinic context required");
    }
    return this.usersService.getStaffDetails(user.clinicId, userId);
  }

  @Patch("staff/:userId/status")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.MANAGE_CLINIC_STAFF)
  async updateStaffStatus(
    @CurrentUser() user: RequestUser,
    @Param("userId") userId: string,
    @Body() body: { isActive: boolean; clinicId?: string },
  ) {
    const clinicId = user.isSuperAdmin ? body.clinicId : user.clinicId;
    if (!clinicId) {
      throw new ForbiddenException("Clinic context required");
    }
    return this.usersService.updateStaffStatus(clinicId, userId, body.isActive, user.userId);
  }

  @Patch("doctors/:userId/payment")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.UPDATE_CLINIC_PAYMENT_POLICY)
  async updateDoctorPayment(
    @CurrentUser() user: RequestUser,
    @Param("userId") userId: string,
    @Body() dto: UpdateDoctorPaymentDto,
  ) {
    if (!user.clinicId) {
      throw new ForbiddenException("Clinic context required");
    }
    return this.usersService.updateDoctorPayment(user.clinicId, userId, dto);
  }

  @Delete("staff/:userId")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.MANAGE_CLINIC_STAFF)
  async deleteStaff(
    @CurrentUser() user: RequestUser,
    @Param("userId") userId: string,
    @Body() body: { clinicId?: string },
  ) {
    const clinicId = user.isSuperAdmin ? body?.clinicId : user.clinicId;
    if (!clinicId) {
      throw new ForbiddenException("Clinic context required");
    }
    return this.usersService.deleteStaff(clinicId, userId, user.userId);
  }

  @Get("me/profile")
  async profile(@CurrentUser() user: RequestUser) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch("me/profile")
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.userId, dto);
  }
}
