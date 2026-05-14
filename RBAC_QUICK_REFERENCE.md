# RBAC Quick Reference Guide

## 🚀 Quick Start for Developers

### 1. Using Role-Based Decorator

```typescript
import { Roles } from "@core/auth/decorators/roles.decorator";

@Post("doctors")
@Roles(ClinicRole.DOCTOR_ADMIN)
async createDoctor(@CurrentUser() user: RequestUser) {
  // Only DOCTOR_ADMIN can access
}
```

### 2. Using Permission-Based Decorator

```typescript
import { Permissions } from "@core/auth/rbac/permissions.decorator";
import { Permission } from "@core/auth/rbac/role-permissions";

@Post("doctors")
@Permissions(Permission.CREATE_DOCTOR)
async createDoctor(@CurrentUser() user: RequestUser) {
  // Only users with CREATE_DOCTOR permission can access
}
```

### 3. Using RbacService in Controller

```typescript
import { RbacService } from "@core/auth/rbac/rbac.service";

constructor(private rbacService: RbacService) {}

@Post("doctors")
async createDoctor(@CurrentUser() user: RequestUser) {
  // Check permission
  this.rbacService.requirePermission(user, Permission.CREATE_DOCTOR);

  // Check clinic context
  this.rbacService.requireClinicContext(user);

  // Check role
  if (!this.rbacService.isClinicAdmin(user)) {
    throw new ForbiddenException("Clinic admin required");
  }
}
```

### 4. Using Role-Specific Guard

```typescript
import { SuperAdminGuard } from "@core/auth/guards/role-specific.guard";

@Post("clinics")
@UseGuards(SuperAdminGuard)
async createClinic(@CurrentUser() user: RequestUser) {
  // Only Super Admin can access
}
```

---

## 🔑 Permission Names

```typescript
// Super Admin Permissions
Permission.CREATE_CLINIC;
Permission.UPDATE_CLINIC_STATUS;
Permission.VIEW_PLATFORM_STATS;
Permission.MANAGE_PLATFORM_USERS;

// Clinic Admin Permissions
Permission.MANAGE_CLINIC_STAFF;
Permission.CREATE_DOCTOR;
Permission.CREATE_RECEPTIONIST;
Permission.UPDATE_DOCTOR;
Permission.UPDATE_RECEPTIONIST;
Permission.DELETE_DOCTOR;
Permission.DELETE_RECEPTIONIST;
Permission.UPDATE_CLINIC_SETTINGS;
Permission.VIEW_CLINIC_REPORTS;
Permission.VIEW_CLINIC_FINANCIALS;

// Doctor Permissions
Permission.VIEW_OWN_SCHEDULE;
Permission.CREATE_PRESCRIPTION;
Permission.UPDATE_PRESCRIPTION;
Permission.VIEW_PATIENT_HISTORY;
Permission.REQUEST_TESTS;
Permission.VIEW_PATIENT_DATA;

// Receptionist Permissions
Permission.CREATE_PATIENT;
Permission.UPDATE_PATIENT_INFO;
Permission.CREATE_APPOINTMENT;
Permission.UPDATE_APPOINTMENT;
Permission.CANCEL_APPOINTMENT;
Permission.PROCESS_BILLING;
Permission.VIEW_SCHEDULE;
```

---

## 🛡️ RbacService Methods

| Method                                    | Purpose                        | Example                                                                 |
| ----------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `checkPermission(user, permission)`       | Check if user has permission   | `this.rbacService.checkPermission(user, Permission.CREATE_DOCTOR)`      |
| `requirePermission(user, permission)`     | Throw if user lacks permission | `this.rbacService.requirePermission(user, Permission.CREATE_DOCTOR)`    |
| `canManageRole(user, targetRole)`         | Check if can manage role       | `this.rbacService.canManageRole(user, ClinicRole.DOCTOR)`               |
| `requireRoleManagement(user, targetRole)` | Throw if can't manage role     | `this.rbacService.requireRoleManagement(user, ClinicRole.RECEPTIONIST)` |
| `isSuperAdmin(user)`                      | Check if super admin           | `if (this.rbacService.isSuperAdmin(user))`                              |
| `isClinicAdmin(user)`                     | Check if clinic admin          | `if (this.rbacService.isClinicAdmin(user))`                             |
| `isDoctor(user)`                          | Check if doctor                | `if (this.rbacService.isDoctor(user))`                                  |
| `isReceptionist(user)`                    | Check if receptionist          | `if (this.rbacService.isReceptionist(user))`                            |
| `requireClinicContext(user)`              | Throw if no clinic context     | `this.rbacService.requireClinicContext(user)`                           |
| `canAccessClinic(user, clinicId)`         | Check clinic access            | `this.rbacService.canAccessClinic(user, clinic.id)`                     |
| `requireClinicAccess(user, clinicId)`     | Throw if no clinic access      | `this.rbacService.requireClinicAccess(user, clinic.id)`                 |

---

## 📝 Common Patterns

### Pattern 1: Role + Clinic Context

```typescript
@Post("doctors")
@Roles(ClinicRole.DOCTOR_ADMIN)
async createDoctor(@CurrentUser() user: RequestUser, @Body() dto: CreateClinicDoctorDto) {
  this.rbacService.requireClinicContext(user);
  return this.usersService.createDoctor(user.clinicId, dto, user.userId);
}
```

### Pattern 2: Super Admin Only

```typescript
@Post("clinics")
@Permissions(Permission.CREATE_CLINIC)
async createClinic(@CurrentUser() user: RequestUser, @Body() dto: CreateClinicDto) {
  if (!user.isSuperAdmin) {
    throw new ForbiddenException("Super Admin required");
  }
  return this.clinicsService.create(dto, user.userId);
}
```

### Pattern 3: Multiple Roles

```typescript
@Get("schedule")
async getSchedule(@CurrentUser() user: RequestUser) {
  // DOCTOR sees only their appointments
  // DOCTOR_ADMIN and RECEPTIONIST see clinic schedule
  if (user.role === ClinicRole.DOCTOR) {
    return this.appointmentService.getDoctorSchedule(user.userId);
  } else {
    return this.appointmentService.getClinicSchedule(user.clinicId);
  }
}
```

### Pattern 4: Role Management

```typescript
async createStaff(
  @CurrentUser() user: RequestUser,
  @Body() dto: { role: ClinicRole }
) {
  // Validate user can manage this role
  this.rbacService.requireRoleManagement(user, dto.role);

  // Create staff...
}
```

### Pattern 5: Medical Data Protection

```typescript
@Get("patient/:id/history")
async getPatientHistory(@CurrentUser() user: RequestUser, @Param("id") patientId: string) {
  // Only doctors can see patient history
  this.rbacService.requirePermission(user, Permission.VIEW_PATIENT_HISTORY);

  // Receptionists cannot see this
  if (user.role === ClinicRole.RECEPTIONIST) {
    throw new ForbiddenException("Medical data not accessible to receptionists");
  }

  return this.patientService.getHistory(patientId);
}
```

---

## 🔄 Current User Object Structure

```typescript
interface RequestUser {
  userId: string; // User ID
  email: string; // User email
  clinicId?: string; // Clinic ID (null for Super Admin)
  clinicSlug?: string; // Clinic slug (null for Super Admin)
  clinicName?: string; // Clinic name (null for Super Admin)
  isSuperAdmin: boolean; // Is Super Admin
  role?: ClinicRole; // DOCTOR_ADMIN, DOCTOR, or RECEPTIONIST (null for Super Admin)
}
```

---

## ✨ Decorator Combinations

```typescript
// Role + Permission (both must pass)
@Post("doctors")
@Roles(ClinicRole.DOCTOR_ADMIN)
@Permissions(Permission.CREATE_DOCTOR)
async createDoctor(...) {}

// Only role
@Post("doctors")
@Roles(ClinicRole.DOCTOR_ADMIN)
async createDoctor(...) {}

// Only permission
@Post("doctors")
@Permissions(Permission.CREATE_DOCTOR)
async createDoctor(...) {}

// With guard
@Post("clinics")
@UseGuards(SuperAdminGuard)
async createClinic(...) {}

// Public endpoint (no auth)
@Get("health")
@Public()
async health() {}
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Don't: Forget clinic context check

```typescript
// Wrong - Super Admin can access other clinics
@Get("staff")
@Roles(ClinicRole.DOCTOR_ADMIN)
async getStaff(@CurrentUser() user: RequestUser) {
  return this.usersService.listClinicStaff(user.clinicId); // What if user is Super Admin?
}

// Right
@Get("staff")
@Roles(ClinicRole.DOCTOR_ADMIN)
async getStaff(@CurrentUser() user: RequestUser) {
  this.rbacService.requireClinicContext(user);
  return this.usersService.listClinicStaff(user.clinicId);
}
```

### ❌ Don't: Allow privilege escalation

```typescript
// Wrong - Doctor can create Doctor Admin
@Post("admin")
async createAdmin(@CurrentUser() user: RequestUser, @Body() dto: CreateAdminDto) {
  return this.usersService.create(dto, ClinicRole.DOCTOR_ADMIN);
}

// Right
@Post("admin")
async createAdmin(@CurrentUser() user: RequestUser, @Body() dto: CreateAdminDto) {
  this.rbacService.requireRoleManagement(user, ClinicRole.DOCTOR_ADMIN);
  return this.usersService.create(dto, ClinicRole.DOCTOR_ADMIN);
}
```

### ❌ Don't: Let receptionists see medical data

```typescript
// Wrong - Receptionist can see patient history
@Get("patient/:id/history")
async getHistory(@CurrentUser() user: RequestUser, @Param("id") patientId: string) {
  return this.patientService.getHistory(patientId);
}

// Right
@Get("patient/:id/history")
@Roles(ClinicRole.DOCTOR, ClinicRole.DOCTOR_ADMIN)
async getHistory(@CurrentUser() user: RequestUser, @Param("id") patientId: string) {
  return this.patientService.getHistory(patientId);
}
```

### ❌ Don't: Forget audit logging

```typescript
// Wrong - No audit trail
async createDoctor(clinicId: string, dto: CreateDoctorDto, userId: string) {
  const newUser = await this.prisma.user.create({...});
  return newUser;
}

// Right - Audit trail included
async createDoctor(clinicId: string, dto: CreateDoctorDto, userId: string) {
  const newUser = await this.prisma.user.create({...});

  await this.prisma.auditLog.create({
    data: {
      clinicId,
      actorId: userId,
      action: "CLINIC_DOCTOR_CREATED",
      entityType: "User",
      entityId: newUser.id,
      meta: { email: newUser.email },
    },
  });

  return newUser;
}
```

---

## 📚 Documentation Files

| File                             | Purpose                          |
| -------------------------------- | -------------------------------- |
| `RBAC_DOCUMENTATION.md`          | Complete system documentation    |
| `RBAC_EXAMPLES.ts`               | Code examples for all scenarios  |
| `RBAC_SETUP_TESTING.md`          | Setup guide and test cases       |
| `RBAC_ARCHITECTURE.md`           | System architecture and diagrams |
| `RBAC_QUICK_REFERENCE.md`        | This file                        |
| `RBAC_IMPLEMENTATION_SUMMARY.md` | Executive summary                |

---

## 🔗 Key Files

| File                                          | Purpose                                 |
| --------------------------------------------- | --------------------------------------- |
| `src/core/auth/rbac/role-permissions.ts`      | Role & permission definitions           |
| `src/core/auth/rbac/rbac.service.ts`          | RBAC service                            |
| `src/core/auth/rbac/permissions.decorator.ts` | @Permissions decorator                  |
| `src/core/auth/guards/permissions.guard.ts`   | PermissionsGuard                        |
| `src/core/auth/guards/role-specific.guard.ts` | SuperAdminGuard, ClinicAdminGuard, etc. |
| `src/core/auth/auth.module.ts`                | Auth module configuration               |
| `src/modules/users/users.controller.ts`       | Users endpoints                         |
| `src/modules/users/users.service.ts`          | Users business logic                    |
| `src/modules/clinics/clinics.controller.ts`   | Clinics endpoints                       |
| `src/modules/clinics/clinics.service.ts`      | Clinics business logic                  |

---

## 🎯 Implementation Checklist

- [x] Role hierarchy defined
- [x] Permission system implemented
- [x] Guards created
- [x] Decorators implemented
- [x] Clinic context validation
- [x] Audit logging
- [x] Staff management endpoints
- [x] Clinic management endpoints
- [ ] Patient endpoints (coming soon)
- [ ] Appointment endpoints (coming soon)
- [ ] Prescription endpoints (coming soon)
- [ ] Billing endpoints (coming soon)

---

## 📞 Getting Help

1. Check `RBAC_DOCUMENTATION.md` for detailed explanations
2. Review `RBAC_EXAMPLES.ts` for code samples
3. See `RBAC_SETUP_TESTING.md` for test cases
4. Read `RBAC_ARCHITECTURE.md` for system design

---

**Need to add new permission?**

1. Add to `Permission` enum in `role-permissions.ts`
2. Add to `ROLE_PERMISSIONS` mapping
3. Use in decorator or service
4. Add test case in `RBAC_SETUP_TESTING.md`

**Need new role?**

1. Add to `ClinicRole` enum in Prisma schema
2. Add to `ROLE_PERMISSIONS` mapping
3. Add to `ROLE_HIERARCHY` mapping
4. Create appropriate guard if needed
5. Update documentation
