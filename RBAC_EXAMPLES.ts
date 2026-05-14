import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  ForbiddenException,
  UseGuards,
} from "@nestjs/common";
import { ClinicRole } from "@prisma/client";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { Roles } from "../../core/auth/decorators/roles.decorator";
import { RolesGuard } from "../../core/auth/guards/roles.guard";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { RbacService } from "../../core/auth/rbac/rbac.service";
import { Permission } from "../../core/auth/rbac/role-permissions";
import { Permissions } from "../../core/auth/rbac/permissions.decorator";

// NOTE: This is an example file showing how to implement endpoints using the new RBAC system
// Copy and adapt these patterns to your actual controllers

/**
 * Example: Appointments Controller
 * Shows how different roles access appointment endpoints
 */
@Controller("appointments")
@UseGuards(RolesGuard)
export class AppointmentsControllerExample {
  constructor(private readonly rbacService: RbacService) {}

  /**
   * Doctors can view their own appointments
   * Receptionists can view clinic schedule
   * Doctor Admin can view all clinic appointments
   */
  @Get()
  @Permissions(Permission.VIEW_OWN_SCHEDULE, Permission.VIEW_SCHEDULE)
  async listAppointments(@CurrentUser() user: RequestUser) {
    this.rbacService.requireClinicContext(user);

    // Different queries based on role
    if (user.role === ClinicRole.DOCTOR) {
      // Doctor sees only their appointments
      return `Appointments for doctor ${user.userId}`;
    } else if (user.role === ClinicRole.RECEPTIONIST) {
      // Receptionist sees clinic schedule
      return `Clinic schedule for clinic ${user.clinicId}`;
    } else if (user.role === ClinicRole.DOCTOR_ADMIN) {
      // Doctor Admin sees all clinic appointments
      return `All appointments for clinic ${user.clinicId}`;
    }
  }

  /**
   * Book appointments - Only Receptionists
   */
  @Post()
  @Roles(ClinicRole.RECEPTIONIST)
  @Permissions(Permission.CREATE_APPOINTMENT)
  async createAppointment(@CurrentUser() user: RequestUser, @Body() dto: any) {
    this.rbacService.requireClinicContext(user);
    return `Appointment created by receptionist ${user.userId}`;
  }

  /**
   * Cancel appointments - Only Receptionists
   */
  @Patch(":appointmentId/cancel")
  @Roles(ClinicRole.RECEPTIONIST)
  @Permissions(Permission.CANCEL_APPOINTMENT)
  async cancelAppointment(
    @CurrentUser() user: RequestUser,
    @Param("appointmentId") id: string,
  ) {
    this.rbacService.requireClinicContext(user);
    return `Appointment ${id} cancelled by receptionist`;
  }
}

/**
 * Example: Prescriptions Controller
 * Shows how doctor-specific endpoints work
 */
@Controller("prescriptions")
@UseGuards(RolesGuard)
export class PrescriptionsControllerExample {
  constructor(private readonly rbacService: RbacService) {}

  /**
   * Create prescription - Only Doctors and Doctor Admin
   */
  @Post()
  @Roles(ClinicRole.DOCTOR, ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.CREATE_PRESCRIPTION)
  async createPrescription(@CurrentUser() user: RequestUser, @Body() dto: any) {
    this.rbacService.requireClinicContext(user);
    return `Prescription created by doctor ${user.userId}`;
  }

  /**
   * View patient history - Only Doctors and Doctor Admin
   * (Receptionists should NOT see medical details)
   */
  @Get("patient/:patientId/history")
  @Roles(ClinicRole.DOCTOR, ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.VIEW_PATIENT_HISTORY)
  async getPatientHistory(
    @CurrentUser() user: RequestUser,
    @Param("patientId") patientId: string,
  ) {
    this.rbacService.requireClinicContext(user);

    // Verify patient belongs to the doctor's clinic
    this.rbacService.requireClinicAccess(user, "clinic-id-from-patient");

    return `Medical history for patient ${patientId}`;
  }

  /**
   * Request tests/labs - Only Doctors and Doctor Admin
   */
  @Post(":prescriptionId/request-test")
  @Roles(ClinicRole.DOCTOR, ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.REQUEST_TESTS)
  async requestTest(
    @CurrentUser() user: RequestUser,
    @Param("prescriptionId") id: string,
  ) {
    this.rbacService.requireClinicContext(user);
    return `Test requested for prescription ${id}`;
  }
}

/**
 * Example: Patients Controller
 * Shows mixed role access
 */
@Controller("patients")
@UseGuards(RolesGuard)
export class PatientsControllerExample {
  constructor(private readonly rbacService: RbacService) {}

  /**
   * View patient - Different permissions for different roles
   * Doctors see medical data
   * Receptionists see only contact info
   */
  @Get(":patientId")
  async getPatient(
    @CurrentUser() user: RequestUser,
    @Param("patientId") patientId: string,
  ) {
    this.rbacService.requireClinicContext(user);

    if (
      user.role === ClinicRole.DOCTOR ||
      user.role === ClinicRole.DOCTOR_ADMIN
    ) {
      this.rbacService.requirePermission(user, Permission.VIEW_PATIENT_DATA);
      return `Full patient data for ${patientId} (medical info included)`;
    } else if (user.role === ClinicRole.RECEPTIONIST) {
      this.rbacService.requirePermission(user, Permission.UPDATE_PATIENT_INFO);
      return `Patient contact info for ${patientId} (no medical data)`;
    }

    throw new ForbiddenException("Cannot access patient data");
  }

  /**
   * Register patient - Only Receptionists and Doctor Admin
   */
  @Post()
  @Permissions(Permission.CREATE_PATIENT)
  async createPatient(@CurrentUser() user: RequestUser, @Body() dto: any) {
    this.rbacService.requireClinicContext(user);

    // Only Receptionists and Doctor Admin can create patients
    if (
      user.role !== ClinicRole.RECEPTIONIST &&
      user.role !== ClinicRole.DOCTOR_ADMIN
    ) {
      throw new ForbiddenException(
        "Only Receptionists and Clinic Admin can register patients",
      );
    }

    return `Patient registered by ${user.role}`;
  }

  /**
   * Update patient - Receptionists can update contact info only
   */
  @Patch(":patientId")
  @Permissions(Permission.UPDATE_PATIENT_INFO)
  async updatePatient(
    @CurrentUser() user: RequestUser,
    @Param("patientId") patientId: string,
    @Body() dto: any,
  ) {
    this.rbacService.requireClinicContext(user);

    if (
      user.role !== ClinicRole.RECEPTIONIST &&
      user.role !== ClinicRole.DOCTOR_ADMIN
    ) {
      throw new ForbiddenException(
        "Only Receptionists and Clinic Admin can update patient info",
      );
    }

    return `Patient ${patientId} updated`;
  }
}

/**
 * Example: Billing Controller
 * Shows receptionist-specific operations
 */
@Controller("billing")
@UseGuards(RolesGuard)
export class BillingControllerExample {
  constructor(private readonly rbacService: RbacService) {}

  /**
   * Process payment - Only Receptionists
   */
  @Post("payment")
  @Roles(ClinicRole.RECEPTIONIST)
  @Permissions(Permission.PROCESS_BILLING)
  async processPayment(@CurrentUser() user: RequestUser, @Body() dto: any) {
    this.rbacService.requireClinicContext(user);
    return `Payment processed by receptionist ${user.userId}`;
  }

  /**
   * Generate invoice - Only Receptionists
   */
  @Post("invoice")
  @Roles(ClinicRole.RECEPTIONIST)
  @Permissions(Permission.PROCESS_BILLING)
  async generateInvoice(@CurrentUser() user: RequestUser, @Body() dto: any) {
    this.rbacService.requireClinicContext(user);
    return `Invoice generated by receptionist`;
  }
}

/**
 * Example: Clinic Settings Controller
 * Shows clinic admin-only operations
 */
@Controller("clinic")
@UseGuards(RolesGuard)
export class ClinicSettingsControllerExample {
  constructor(private readonly rbacService: RbacService) {}

  /**
   * Update clinic settings - Only Doctor Admin (Clinic Admin)
   */
  @Patch("settings")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.UPDATE_CLINIC_SETTINGS)
  async updateSettings(@CurrentUser() user: RequestUser, @Body() dto: any) {
    this.rbacService.requireClinicContext(user);
    this.rbacService.requirePermission(user, Permission.UPDATE_CLINIC_SETTINGS);
    return `Clinic settings updated`;
  }

  /**
   * View clinic reports - Only Doctor Admin
   */
  @Get("reports")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.VIEW_CLINIC_REPORTS)
  async getReports(@CurrentUser() user: RequestUser) {
    this.rbacService.requireClinicContext(user);
    return `Clinical reports for clinic ${user.clinicId}`;
  }

  /**
   * View financial reports - Only Doctor Admin
   */
  @Get("financials")
  @Roles(ClinicRole.DOCTOR_ADMIN)
  @Permissions(Permission.VIEW_CLINIC_FINANCIALS)
  async getFinancials(@CurrentUser() user: RequestUser) {
    this.rbacService.requireClinicContext(user);
    return `Financial data for clinic ${user.clinicId}`;
  }
}

/**
 * Example: Super Admin Platform Endpoints
 * Shows platform-level operations
 */
@Controller("admin/platform")
@UseGuards(RolesGuard)
export class PlatformAdminControllerExample {
  constructor(private readonly rbacService: RbacService) {}

  /**
   * Create clinic - Super Admin only
   */
  @Post("clinics")
  @Permissions(Permission.CREATE_CLINIC)
  async createClinic(@CurrentUser() user: RequestUser, @Body() dto: any) {
    this.rbacService.requirePermission(user, Permission.CREATE_CLINIC);
    if (!user.isSuperAdmin) {
      throw new ForbiddenException("Super Admin access required");
    }
    return "Clinic created by Super Admin";
  }

  /**
   * View platform statistics
   */
  @Get("stats")
  @Permissions(Permission.VIEW_PLATFORM_STATS)
  async getPlatformStats(@CurrentUser() user: RequestUser) {
    this.rbacService.requirePermission(user, Permission.VIEW_PLATFORM_STATS);
    if (!user.isSuperAdmin) {
      throw new ForbiddenException("Super Admin access required");
    }
    return "Platform statistics";
  }

  /**
   * Disable clinic subscription
   */
  @Patch("clinics/:clinicId/disable")
  @Permissions(Permission.UPDATE_CLINIC_STATUS)
  async disableClinic(
    @CurrentUser() user: RequestUser,
    @Param("clinicId") clinicId: string,
  ) {
    this.rbacService.requirePermission(user, Permission.UPDATE_CLINIC_STATUS);
    if (!user.isSuperAdmin) {
      throw new ForbiddenException("Super Admin access required");
    }
    return `Clinic ${clinicId} disabled`;
  }
}

/**
 * Helper patterns for common scenarios
 */

// Pattern 1: Check if user is in clinic context
function requireClinicContext(rbacService: RbacService, user: RequestUser) {
  rbacService.requireClinicContext(
    user,
    "This operation requires a clinic context",
  );
}

// Pattern 2: Check multiple permissions (user must have at least one)
function requireMultiplePermissions(
  rbacService: RbacService,
  user: RequestUser,
  permissions: Permission[],
) {
  const hasAny = permissions.some((p) => rbacService.checkPermission(user, p));
  if (!hasAny) {
    throw new ForbiddenException("Insufficient permissions");
  }
}

// Pattern 3: Role-specific business logic
function getRoleSpecificData(user: RequestUser) {
  if (user.isSuperAdmin) {
    return "Platform-wide data";
  } else if (user.role === ClinicRole.DOCTOR_ADMIN) {
    return `Clinic admin data for clinic ${user.clinicId}`;
  } else if (user.role === ClinicRole.DOCTOR) {
    return `Doctor data for doctor ${user.userId}`;
  } else if (user.role === ClinicRole.RECEPTIONIST) {
    return `Receptionist operational data`;
  }
}

// Pattern 4: Prevent privilege escalation
function validateRoleAssignment(
  rbacService: RbacService,
  actorUser: RequestUser,
  targetRole: ClinicRole,
) {
  rbacService.requireRoleManagement(
    actorUser,
    targetRole,
    `Cannot assign ${targetRole} role`,
  );
}
