# RBAC (Role-Based Access Control) System Documentation

## Overview

The system implements a comprehensive role-based access control with 4 main roles:

1. **SUPER_ADMIN** - Platform Administrator (SaaS Provider)
2. **DOCTOR_ADMIN** - Clinic Manager/Administrator
3. **DOCTOR** - Medical Professional
4. **RECEPTIONIST** - Front Desk Staff

---

## Role Hierarchy

```
SUPER_ADMIN
    ↓
DOCTOR_ADMIN (can manage DOCTOR and RECEPTIONIST)
    ├── DOCTOR (can view schedule and write prescriptions)
    └── RECEPTIONIST (can register patients and book appointments)
```

---

## Detailed Role Descriptions & Permissions

### 1. SUPER_ADMIN (Super Administrator)

**Scope:** Platform-wide (not tied to any clinic)

**Responsibilities:**

- Manage the entire platform (SaaS Provider)
- Create new clinics
- Enable/disable clinic subscriptions
- View platform-wide statistics

**Permissions:**

- `CREATE_CLINIC` - Create new clinic instances
- `UPDATE_CLINIC_STATUS` - Enable/disable clinic subscriptions
- `VIEW_PLATFORM_STATS` - See overall platform statistics
- `MANAGE_PLATFORM_USERS` - Create/manage platform users

**User Model:**

```typescript
{
  userId: string;
  email: string;
  isSuperAdmin: true;
  // No clinicId, clinicSlug, or role required
}
```

**Key Endpoints:**

```
POST   /clinics                      // Create a new clinic
GET    /clinics                      // List all clinics
PATCH  /clinics/:clinicId/status     // Enable/disable clinic
GET    /clinics/stats                // View platform statistics
```

---

### 2. DOCTOR_ADMIN (Clinic Manager/Administrator)

**Scope:** Single Clinic (has clinicId + ClinicUser role)

**Responsibilities:**

- Manage the clinic they're assigned to
- Add/remove doctors and receptionists
- Update clinic settings
- View clinic reports and financials
- Has all doctor permissions (can see patients, write prescriptions)

**Permissions:**

- `MANAGE_CLINIC_STAFF` - Create/update/delete staff
- `CREATE_DOCTOR` - Add doctors to clinic
- `CREATE_RECEPTIONIST` - Add receptionists to clinic
- `UPDATE_DOCTOR` - Modify doctor info
- `UPDATE_RECEPTIONIST` - Modify receptionist info
- `DELETE_DOCTOR` - Remove doctors
- `DELETE_RECEPTIONIST` - Remove receptionists
- `UPDATE_CLINIC_SETTINGS` - Modify clinic configuration
- `VIEW_CLINIC_REPORTS` - View clinical reports
- `VIEW_CLINIC_FINANCIALS` - Access financial data
- **Plus all DOCTOR permissions**

**User Model:**

```typescript
{
  userId: string;
  email: string;
  clinicId: string;
  clinicSlug: string;
  clinicName: string;
  isSuperAdmin: false;
  role: ClinicRole.DOCTOR_ADMIN;
}
```

**Key Endpoints:**

```
POST   /users/doctors                // Create a doctor
GET    /users/doctors                // List doctors
POST   /users/receptionists          // Create a receptionist
GET    /users/receptionists          // List receptionists
GET    /users/staff                  // List all staff
PATCH  /users/staff/:userId/status   // Enable/disable staff
```

---

### 3. DOCTOR (Medical Professional)

**Scope:** Single Clinic (has clinicId + ClinicUser role)

**Responsibilities:**

- Handle patient care and medical operations
- View own schedule/appointments
- Write prescriptions
- Request medical tests
- Access patient medical history

**Permissions:**

- `VIEW_OWN_SCHEDULE` - See appointments assigned to them
- `CREATE_PRESCRIPTION` - Write prescriptions
- `UPDATE_PRESCRIPTION` - Modify own prescriptions
- `VIEW_PATIENT_HISTORY` - Access patient medical records
- `REQUEST_TESTS` - Order lab/imaging tests
- `VIEW_PATIENT_DATA` - See patient information

**User Model:**

```typescript
{
  userId: string;
  email: string;
  clinicId: string;
  clinicSlug: string;
  clinicName: string;
  isSuperAdmin: false;
  role: ClinicRole.DOCTOR;
  specialty?: string;
}
```

**Key Endpoints:**

```
GET    /appointments/my-schedule     // View own appointments
POST   /prescriptions                // Write prescription
PATCH  /prescriptions/:id            // Update prescription
GET    /patients/:id/history         // View patient history
POST   /tests/request                // Request medical test
```

---

### 4. RECEPTIONIST (Front Desk Staff)

**Scope:** Single Clinic (has clinicId + ClinicUser role)

**Responsibilities:**

- Manage front desk operations
- Register patients
- Book appointments
- Process billing
- **Cannot see medical details or prescriptions**

**Permissions:**

- `CREATE_PATIENT` - Register new patients
- `UPDATE_PATIENT_INFO` - Edit patient contact/demographics
- `CREATE_APPOINTMENT` - Book appointments
- `UPDATE_APPOINTMENT` - Modify booking details
- `CANCEL_APPOINTMENT` - Cancel appointments
- `PROCESS_BILLING` - Handle payments and invoices
- `VIEW_SCHEDULE` - See clinic schedule (not medical details)

**User Model:**

```typescript
{
  userId: string;
  email: string;
  clinicId: string;
  clinicSlug: string;
  clinicName: string;
  isSuperAdmin: false;
  role: ClinicRole.RECEPTIONIST;
}
```

**Key Endpoints:**

```
POST   /patients                     // Create patient profile
PATCH  /patients/:id                 // Update patient info
POST   /appointments                 // Book appointment
PATCH  /appointments/:id             // Update appointment
DELETE /appointments/:id             // Cancel appointment
POST   /billing                      // Process payment
```

---

## Implementation Details

### Using the RBAC System

#### 1. Role-Based Decorator

```typescript
import { ClinicRole } from "@prisma/client";
import { Roles } from "@core/auth/decorators/roles.decorator";

@Post("doctors")
@Roles(ClinicRole.DOCTOR_ADMIN)
async createDoctor(@CurrentUser() user: RequestUser, @Body() dto: CreateClinicDoctorDto) {
  // Only DOCTOR_ADMIN role can access this endpoint
}
```

#### 2. Permission-Based Decorator

```typescript
import { Permission } from "@core/auth/rbac/role-permissions";
import { Permissions } from "@core/auth/rbac/permissions.decorator";

@Post("doctors")
@Permissions(Permission.CREATE_DOCTOR)
async createDoctor(@CurrentUser() user: RequestUser, @Body() dto: CreateClinicDoctorDto) {
  // Only users with CREATE_DOCTOR permission can access
}
```

#### 3. Using RbacService in Controllers

```typescript
import { RbacService } from "@core/auth/rbac/rbac.service";

@Controller("users")
export class UsersController {
  constructor(private readonly rbacService: RbacService) {}

  @Post("doctors")
  async createDoctor(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateClinicDoctorDto,
  ) {
    // Check if user can manage DOCTOR role
    this.rbacService.requireRoleManagement(user, ClinicRole.DOCTOR);

    // Check if user has specific permission
    this.rbacService.requirePermission(user, Permission.CREATE_DOCTOR);

    // Check if user is clinic admin
    if (!this.rbacService.isClinicAdmin(user)) {
      throw new ForbiddenException("Clinic admin access required");
    }
  }
}
```

#### 4. Role-Specific Guards

```typescript
import { SuperAdminGuard } from "@core/auth/guards/role-specific.guard";
import { ClinicAdminGuard } from "@core/auth/guards/role-specific.guard";

@Post("clinics")
@UseGuards(SuperAdminGuard)
async createClinic(@CurrentUser() user: RequestUser, @Body() dto: CreateClinicDto) {
  // Only Super Admin can access
}

@Patch("staff/:userId/status")
@UseGuards(ClinicAdminGuard)
async updateStaffStatus(@CurrentUser() user: RequestUser, @Param("userId") userId: string) {
  // Only Clinic Admin can access
}
```

---

## Key Services & Guards

### RbacService Methods

```typescript
// Check if user has permission
checkPermission(user: RequestUser, permission: Permission): boolean

// Require permission (throws if missing)
requirePermission(user: RequestUser, permission: Permission): void

// Check if can manage a role (e.g., DOCTOR_ADMIN can manage DOCTOR)
canManageRole(user: RequestUser, targetRole: ClinicRole): boolean

// Require role management capability
requireRoleManagement(user: RequestUser, targetRole: ClinicRole): void

// Role type checks
isSuperAdmin(user: RequestUser): boolean
isClinicAdmin(user: RequestUser): boolean
isDoctor(user: RequestUser): boolean
isReceptionist(user: RequestUser): boolean

// Clinic context checks
requireClinicContext(user: RequestUser): void
canAccessClinic(user: RequestUser, clinicId: string): boolean
```

### Available Guards

- **JwtAuthGuard** - Validates JWT token
- **RolesGuard** - Checks role-based access using `@Roles()` decorator
- **PermissionsGuard** - Checks permission-based access using `@Permissions()` decorator
- **SuperAdminGuard** - Ensures user is Super Admin
- **ClinicAdminGuard** - Ensures user is Clinic Admin
- **DoctorGuard** - Ensures user is Doctor or higher
- **ReceptionistGuard** - Ensures user is Receptionist

---

## Audit Logging

All role-based actions are logged automatically:

```typescript
await this.prisma.auditLog.create({
  data: {
    clinicId: clinicId,
    actorId: user.userId,
    action: "CLINIC_DOCTOR_CREATED",
    entityType: "User",
    entityId: newUserId,
    meta: { email: doctorEmail },
  },
});
```

**Common Audit Actions:**

- `CLINIC_CREATED` - New clinic created
- `CLINIC_ACTIVATED` / `CLINIC_DEACTIVATED` - Clinic status changed
- `CLINIC_DOCTOR_CREATED` - Doctor added to clinic
- `CLINIC_RECEPTIONIST_CREATED` - Receptionist added to clinic
- `CLINIC_STAFF_ACTIVATED` / `CLINIC_STAFF_DEACTIVATED` - Staff status changed

---

## Permission Hierarchy

```
SUPER_ADMIN
├── CREATE_CLINIC
├── UPDATE_CLINIC_STATUS
├── VIEW_PLATFORM_STATS
└── MANAGE_PLATFORM_USERS

DOCTOR_ADMIN (inherits all below + doctor permissions)
├── MANAGE_CLINIC_STAFF
├── CREATE_DOCTOR
├── CREATE_RECEPTIONIST
├── UPDATE_DOCTOR
├── UPDATE_RECEPTIONIST
├── DELETE_DOCTOR
├── DELETE_RECEPTIONIST
├── UPDATE_CLINIC_SETTINGS
├── VIEW_CLINIC_REPORTS
├── VIEW_CLINIC_FINANCIALS
└── [DOCTOR permissions]

DOCTOR
├── VIEW_OWN_SCHEDULE
├── CREATE_PRESCRIPTION
├── UPDATE_PRESCRIPTION
├── VIEW_PATIENT_HISTORY
├── REQUEST_TESTS
└── VIEW_PATIENT_DATA

RECEPTIONIST
├── CREATE_PATIENT
├── UPDATE_PATIENT_INFO
├── CREATE_APPOINTMENT
├── UPDATE_APPOINTMENT
├── CANCEL_APPOINTMENT
├── PROCESS_BILLING
└── VIEW_SCHEDULE
```

---

## Best Practices

1. **Always check clinic context** for non-super-admin users:

   ```typescript
   this.rbacService.requireClinicContext(user);
   ```

2. **Use permission checks for sensitive operations**:

   ```typescript
   @Post("doctors")
   @Permissions(Permission.CREATE_DOCTOR)
   async createDoctor(...) {}
   ```

3. **Validate role management capabilities**:

   ```typescript
   this.rbacService.requireRoleManagement(user, ClinicRole.RECEPTIONIST);
   ```

4. **Log all admin actions** for audit trail:

   ```typescript
   await this.prisma.auditLog.create({...});
   ```

5. **Prevent privilege escalation** by ensuring higher roles can only create lower roles:
   ```typescript
   // DOCTOR_ADMIN cannot create other DOCTOR_ADMIN users
   this.rbacService.requireRoleManagement(user, targetRole);
   ```

---

## Example: Creating a Receptionist

```typescript
// 1. User must be DOCTOR_ADMIN in a clinic
@Post("receptionists")
@Roles(ClinicRole.DOCTOR_ADMIN)
@Permissions(Permission.CREATE_RECEPTIONIST)
async createReceptionist(@CurrentUser() user: RequestUser, @Body() dto: CreateClinicDoctorDto) {
  // 2. Ensure clinic context
  if (!user.clinicId) {
    throw new ForbiddenException("Clinic context required");
  }

  // 3. Service validates and creates receptionist
  return this.usersService.createReceptionist(user.clinicId, dto, user.userId);
}

// 4. Service implementation
async createReceptionist(clinicId: string, dto: CreateClinicDoctorDto, actorUserId: string) {
  // Create user account
  const userId = await createUserAccount(dto);

  // Create ClinicUser with RECEPTIONIST role
  await this.prisma.clinicUser.create({
    data: {
      clinicId,
      userId,
      role: ClinicRole.RECEPTIONIST,
      isActive: true,
    },
  });

  // 5. Log the action
  await this.prisma.auditLog.create({
    data: {
      clinicId,
      actorId: actorUserId,
      action: "CLINIC_RECEPTIONIST_CREATED",
      entityType: "User",
      entityId: userId,
      meta: { email: dto.email },
    },
  });

  return result;
}
```

---

## Summary

The RBAC system provides:

- ✅ Clear role hierarchy
- ✅ Fine-grained permissions
- ✅ Flexible access control (both role-based and permission-based)
- ✅ Automatic audit logging
- ✅ Prevention of privilege escalation
- ✅ Clinic context awareness
- ✅ Easy extensibility for new permissions
