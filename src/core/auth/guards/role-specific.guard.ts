import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RequestUser } from "../types/request-user.type";

/**
 * Guard to ensure user is Super Admin
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException("No authenticated user found");
    }

    if (!user.isSuperAdmin) {
      throw new ForbiddenException("Super Admin access required");
    }

    return true;
  }
}

/**
 * Guard to ensure user is Clinic Admin (Doctor Admin)
 */
@Injectable()
export class ClinicAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException("No authenticated user found");
    }

    if (!user.clinicId) {
      throw new ForbiddenException("Clinic context required");
    }

    if (user.role !== "DOCTOR_ADMIN") {
      throw new ForbiddenException("Clinic Admin access required");
    }

    return true;
  }
}

/**
 * Guard to ensure user is a Doctor or higher
 */
@Injectable()
export class DoctorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException("No authenticated user found");
    }

    if (!user.clinicId) {
      throw new ForbiddenException("Clinic context required");
    }

    if (user.role !== "DOCTOR_ADMIN") {
      throw new ForbiddenException("Doctor access required");
    }

    return true;
  }
}

/**
 * Guard to ensure user is a Receptionist
 */
@Injectable()
export class ReceptionistGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException("No authenticated user found");
    }

    if (!user.clinicId) {
      throw new ForbiddenException("Clinic context required");
    }

    if (user.role !== "RECEPTIONIST") {
      throw new ForbiddenException("Receptionist access required");
    }

    return true;
  }
}
