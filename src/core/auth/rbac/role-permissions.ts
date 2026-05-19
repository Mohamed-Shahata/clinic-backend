import { ClinicRole } from "@prisma/client";

export const DOCTOR_ROLE = "DOCTOR" as ClinicRole;

/**
 * Permission types that define what actions can be performed
 */
export enum Permission {
  // Super Admin Permissions
  CREATE_CLINIC = "create:clinic",
  UPDATE_CLINIC_STATUS = "update:clinic_status",
  VIEW_PLATFORM_STATS = "view:platform_stats",
  MANAGE_PLATFORM_USERS = "manage:platform_users",
  VIEW_AUDIT_LOGS = "view:audit_logs",

  // Doctor Admin Permissions
  MANAGE_CLINIC_STAFF = "manage:clinic_staff",
  CREATE_RECEPTIONIST = "create:receptionist",
  UPDATE_RECEPTIONIST = "update:receptionist",
  DELETE_RECEPTIONIST = "delete:receptionist",
  UPDATE_CLINIC_SETTINGS = "update:clinic_settings",
  UPDATE_CLINIC_PAYMENT_POLICY = "update:clinic_payment_policy",
  VIEW_CLINIC_REPORTS = "view:clinic_reports",
  VIEW_CLINIC_FINANCIALS = "view:clinic_financials",
  EXPORT_CLINIC_DATA = "export:clinic_data",

  // Doctor Admin (acting as doctor) Permissions
  VIEW_OWN_SCHEDULE = "view:own_schedule",
  CREATE_PRESCRIPTION = "create:prescription",
  UPDATE_PRESCRIPTION = "update:prescription",
  VIEW_PATIENT_HISTORY = "view:patient_history",
  REQUEST_TESTS = "request:tests",
  VIEW_PATIENT_DATA = "view:patient_data",

  // Receptionist Permissions
  CREATE_PATIENT = "create:patient",
  UPDATE_PATIENT_INFO = "update:patient_info",
  CREATE_APPOINTMENT = "create:appointment",
  UPDATE_APPOINTMENT = "update:appointment",
  CANCEL_APPOINTMENT = "cancel:appointment",
  PROCESS_BILLING = "process:billing",
  VIEW_SCHEDULE = "view:schedule",
  VIEW_QUEUE = "view:queue",
  CREATE_INVOICE = "create:invoice",
  UPDATE_INVOICE = "update:invoice",
  DELETE_INVOICE = "delete:invoice",
  VIEW_BILLING = "view:billing",
}

/**
 * Role hierarchy and their permissions
 * Roles: SUPER_ADMIN, DOCTOR_ADMIN, DOCTOR, RECEPTIONIST
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    Permission.CREATE_CLINIC,
    Permission.UPDATE_CLINIC_STATUS,
    Permission.VIEW_PLATFORM_STATS,
    Permission.MANAGE_PLATFORM_USERS,
    Permission.VIEW_AUDIT_LOGS,
  ],

  DOCTOR_ADMIN: [
    // Clinic management
    Permission.MANAGE_CLINIC_STAFF,
    Permission.CREATE_RECEPTIONIST,
    Permission.UPDATE_RECEPTIONIST,
    Permission.DELETE_RECEPTIONIST,
    Permission.UPDATE_CLINIC_SETTINGS,
    Permission.UPDATE_CLINIC_PAYMENT_POLICY,
    Permission.VIEW_CLINIC_REPORTS,
    Permission.VIEW_CLINIC_FINANCIALS,
    Permission.EXPORT_CLINIC_DATA,
    Permission.CREATE_PATIENT,
    Permission.UPDATE_PATIENT_INFO,
    Permission.CREATE_APPOINTMENT,
    Permission.UPDATE_APPOINTMENT,
    Permission.CANCEL_APPOINTMENT,
    Permission.VIEW_SCHEDULE,
    // Doctor permissions
    Permission.VIEW_OWN_SCHEDULE,
    Permission.CREATE_PRESCRIPTION,
    Permission.UPDATE_PRESCRIPTION,
    Permission.VIEW_PATIENT_HISTORY,
    Permission.REQUEST_TESTS,
    Permission.VIEW_PATIENT_DATA,
    Permission.VIEW_QUEUE,
    Permission.VIEW_BILLING,
    Permission.CREATE_INVOICE,
    Permission.UPDATE_INVOICE,
    Permission.DELETE_INVOICE,
  ],

  [DOCTOR_ROLE]: [
    Permission.VIEW_OWN_SCHEDULE,
    Permission.CREATE_PRESCRIPTION,
    Permission.UPDATE_PRESCRIPTION,
    Permission.VIEW_PATIENT_HISTORY,
    Permission.REQUEST_TESTS,
    Permission.VIEW_PATIENT_DATA,
    Permission.CREATE_INVOICE,
    Permission.VIEW_BILLING,
  ],

  RECEPTIONIST: [
    Permission.CREATE_PATIENT,
    Permission.UPDATE_PATIENT_INFO,
    Permission.CREATE_APPOINTMENT,
    Permission.UPDATE_APPOINTMENT,
    Permission.CANCEL_APPOINTMENT,
    Permission.PROCESS_BILLING,
    Permission.CREATE_INVOICE,
    Permission.UPDATE_INVOICE,
    Permission.DELETE_INVOICE,
    Permission.VIEW_BILLING,
    Permission.VIEW_SCHEDULE,
    // FIX-3: الـ RECEPTIONIST محتاج VIEW_PATIENT_DATA عشان يشوف قائمة المرضى
    // والـ patients controller بيطلب هالـ permission في الـ @Permissions decorator
    Permission.VIEW_PATIENT_DATA,
  ],
};

/**
 * Role hierarchy - defines which roles can manage which other roles
 */
export const ROLE_HIERARCHY: Record<string, ClinicRole[]> = {
  SUPER_ADMIN: ["DOCTOR_ADMIN", DOCTOR_ROLE, "RECEPTIONIST"],
  DOCTOR_ADMIN: [DOCTOR_ROLE, "RECEPTIONIST"],
  [DOCTOR_ROLE]: [],
  RECEPTIONIST: [],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: ClinicRole | "SUPER_ADMIN",
  permission: Permission,
): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Check if an actor role can manage a target role
 */
export function canManageRole(
  actorRole: ClinicRole | "SUPER_ADMIN",
  targetRole: ClinicRole,
): boolean {
  const manageable = ROLE_HIERARCHY[actorRole] || [];
  return manageable.includes(targetRole);
}

/**
 * Get all permissions for a role
 */
export function getAllPermissions(
  role: ClinicRole | "SUPER_ADMIN",
): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
