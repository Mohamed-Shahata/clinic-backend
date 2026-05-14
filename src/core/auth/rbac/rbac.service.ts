import { ForbiddenException, Injectable } from "@nestjs/common";
import { ClinicRole } from "@prisma/client";
import { Permission, canManageRole, hasPermission } from "./role-permissions";
import { RequestUser } from "../types/request-user.type";

@Injectable()
export class RbacService {
  checkPermission(user: RequestUser, permission: Permission): boolean {
    if (user.isSuperAdmin) return true;
    if (!user.role) return false;
    return hasPermission(user.role, permission);
  }

  requirePermission(user: RequestUser, permission: Permission, message?: string): void {
    if (!this.checkPermission(user, permission)) {
      throw new ForbiddenException(message || `Missing permission: ${permission}`);
    }
  }

  canManageRole(user: RequestUser, targetRole: ClinicRole): boolean {
    if (user.isSuperAdmin) return true;
    if (!user.role) return false;
    return canManageRole(user.role, targetRole);
  }

  requireRoleManagement(user: RequestUser, targetRole: ClinicRole, message?: string): void {
    if (!this.canManageRole(user, targetRole)) {
      throw new ForbiddenException(message || `Cannot manage role: ${targetRole}`);
    }
  }

  isSuperAdmin(user: RequestUser): boolean {
    return user.isSuperAdmin;
  }

  isClinicAdmin(user: RequestUser): boolean {
    return user.role === ClinicRole.DOCTOR_ADMIN;
  }

  isReceptionist(user: RequestUser): boolean {
    return user.role === ClinicRole.RECEPTIONIST;
  }

  requireClinicContext(user: RequestUser, message?: string): void {
    if (user.isSuperAdmin || !user.clinicId) {
      throw new ForbiddenException(message || "Clinic context required");
    }
  }

  isRoleHigherOrEqual(
    role1: ClinicRole | "SUPER_ADMIN",
    role2: ClinicRole | "SUPER_ADMIN",
  ): boolean {
    const hierarchy = ["SUPER_ADMIN", "DOCTOR_ADMIN", "DOCTOR", "RECEPTIONIST"];
    return hierarchy.indexOf(role1) <= hierarchy.indexOf(role2);
  }

  canAccessClinic(user: RequestUser, clinicId: string): boolean {
    if (user.isSuperAdmin) return true;
    return user.clinicId === clinicId;
  }

  requireClinicAccess(user: RequestUser, clinicId: string, message?: string): void {
    if (!this.canAccessClinic(user, clinicId)) {
      throw new ForbiddenException(message || "Cannot access this clinic");
    }
  }
}
