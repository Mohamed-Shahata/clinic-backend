# RBAC System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Request                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               JwtAuthGuard (Validates Token)                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              RolesGuard (Checks @Roles Decorator)                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           PermissionsGuard (Checks @Permissions)                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│         Role-Specific Guards (SuperAdminGuard, etc)              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Controller Handler                             │
│        (Uses RbacService for additional checks)                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Business Logic (Service)                      │
│          (Includes audit logging on write operations)            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database (Prisma)                             │
└─────────────────────────────────────────────────────────────────┘
```

## User Context Flow

```
┌─────────────────────────────────┐
│        JWT Token Payload        │
├─────────────────────────────────┤
│ sub: userId                     │
│ email: user@domain.com          │
│ isSuperAdmin: boolean           │
│ clinicId?: string               │
│ clinicSlug?: string             │
│ clinicName?: string             │
│ role?: ClinicRole               │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│     JwtStrategy Extracts        │
│         Payload Data            │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│    Creates RequestUser Object   │
├─────────────────────────────────┤
│ userId: string                  │
│ email: string                   │
│ clinicId?: string               │
│ clinicSlug?: string             │
│ clinicName?: string             │
│ isSuperAdmin: boolean           │
│ role?: ClinicRole               │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│    Available in @CurrentUser()  │
│    Decorator in Handlers        │
└─────────────────────────────────┘
```

## Role & Permission Flow

```
┌──────────────────────────────────────────────────┐
│         User Has ClinicRole                      │
│  (DOCTOR_ADMIN, DOCTOR, RECEPTIONIST)            │
└────────────────────┬─────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────────┐  ┌──────────────────────┐
│  Role Hierarchy   │  │  Role Permissions    │
│                   │  │                      │
│ DOCTOR_ADMIN can  │  │ Each role has set of │
│ manage:           │  │ permissions:         │
│ - DOCTOR          │  │ - CREATE_PRESCRIPTION│
│ - RECEPTIONIST    │  │ - VIEW_SCHEDULE      │
│                   │  │ - CREATE_PATIENT     │
│ DOCTOR can        │  │ - etc.               │
│ manage: (none)    │  │                      │
│                   │  │ Guards check:        │
│ RECEPTIONIST      │  │ 1. Role requirement │
│ can manage:       │  │ 2. Permission grant │
│ (none)            │  │                      │
└───────────────────┘  └──────────────────────┘
        │                         │
        │                         │
        └────────────┬────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │   RbacService Methods  │
        ├────────────────────────┤
        │ checkPermission()       │
        │ requirePermission()     │
        │ canManageRole()         │
        │ isClinicAdmin()         │
        │ requireClinicContext()  │
        │ canAccessClinic()       │
        └────────────────────────┘
```

## Data Model Relationships

```
┌──────────────┐
│    User      │
├──────────────┤
│ id           │
│ email        │
│ passwordHash │
│ fullName     │
│ isSuperAdmin │
│ createdAt    │
│ updatedAt    │
└──────┬───────┘
       │ 1:N
       │
       ▼
┌──────────────┐
│  ClinicUser  │
├──────────────┤
│ id           │
│ clinicId (FK)│
│ userId (FK)  │
│ role         │ ← DOCTOR_ADMIN, DOCTOR, RECEPTIONIST
│ specialty    │
│ isActive     │
│ createdAt    │
└──────┬───────┘
       │ N:1
       │
       ▼
┌──────────────┐
│   Clinic     │
├──────────────┤
│ id           │
│ slug         │
│ name         │
│ timezone     │
│ defaultLocale│
│ createdAt    │
│ updatedAt    │
└──────────────┘

┌──────────────┐
│  AuditLog    │
├──────────────┤
│ id           │
│ clinicId (FK)│
│ actorId (FK) │
│ action       │
│ entityType   │
│ entityId     │
│ meta         │
│ createdAt    │
└──────────────┘
```

## Permission Matrix

```
                    SUPER_ADMIN  DOCTOR_ADMIN  DOCTOR  RECEPTIONIST
CREATE_CLINIC            ✓            ✗          ✗         ✗
UPDATE_CLINIC_STATUS     ✓            ✗          ✗         ✗
VIEW_PLATFORM_STATS      ✓            ✗          ✗         ✗
MANAGE_CLINIC_STAFF      ✓            ✓          ✗         ✗
CREATE_DOCTOR            ✓            ✓          ✗         ✗
CREATE_RECEPTIONIST      ✓            ✓          ✗         ✗
UPDATE_CLINIC_SETTINGS   ✓            ✓          ✗         ✗
VIEW_CLINIC_REPORTS      ✓            ✓          ✗         ✗
VIEW_CLINIC_FINANCIALS   ✓            ✓          ✗         ✗
VIEW_OWN_SCHEDULE        ✓            ✓          ✓         ✗
CREATE_PRESCRIPTION      ✓            ✓          ✓         ✗
VIEW_PATIENT_HISTORY     ✓            ✓          ✓         ✗
REQUEST_TESTS            ✓            ✓          ✓         ✗
CREATE_PATIENT           ✓            ✓          ✗         ✓
UPDATE_PATIENT_INFO      ✓            ✓          ✗         ✓
CREATE_APPOINTMENT       ✓            ✓          ✗         ✓
CANCEL_APPOINTMENT       ✓            ✓          ✗         ✓
PROCESS_BILLING          ✓            ✓          ✗         ✓
VIEW_SCHEDULE            ✓            ✓          ✓         ✓
```

## Guard Chain

```
Request
   │
   ▼
[JwtAuthGuard] ─────── Validates token
   │ No token ────→ 401 Unauthorized
   │
   ▼
[RolesGuard] ────────── Checks @Roles()
   │ Invalid role ─→ 403 Forbidden
   │
   ▼
[PermissionsGuard] ──── Checks @Permissions()
   │ Missing permission ─→ 403 Forbidden
   │
   ▼
[Role-Specific Guard] ─ SuperAdminGuard, ClinicAdminGuard, etc
   │ Wrong role ────→ 403 Forbidden
   │
   ▼
[Controller Handler] ── RbacService.require*() methods
   │ Validation fails ──→ 403 Forbidden
   │
   ▼
[Service Logic]
   │
   ▼
Database Operation + Audit Log
   │
   ▼
Response
```

## File Structure

```
src/core/auth/
├── rbac/
│   ├── role-permissions.ts      ← Role & permission definitions
│   ├── rbac.service.ts          ← Central RBAC service
│   ├── permissions.decorator.ts ← @Permissions() decorator
│   └── index.ts                 ← Exports
├── guards/
│   ├── jwt-auth.guard.ts        ← JWT validation
│   ├── roles.guard.ts           ← Role checking
│   ├── permissions.guard.ts     ← Permission checking
│   └── role-specific.guard.ts   ← SuperAdminGuard, ClinicAdminGuard, etc
├── decorators/
│   ├── current-user.decorator.ts ← @CurrentUser()
│   ├── public.decorator.ts       ← @Public()
│   └── roles.decorator.ts        ← @Roles()
├── dto/
├── strategies/
├── types/
└── auth.module.ts               ← Module configuration
```

## Typical Request Flow Example

### Creating a Receptionist

```
POST /users/receptionists
Header: Authorization: Bearer <clinic-admin-token>
Body: { email, fullName, password }

    │
    ▼
1. JwtAuthGuard validates token
   └─ Extracts: isSuperAdmin=false, clinicId=clinic_123, role=DOCTOR_ADMIN

    │
    ▼
2. RolesGuard checks @Roles(ClinicRole.DOCTOR_ADMIN)
   └─ User.role = DOCTOR_ADMIN ✓

    │
    ▼
3. PermissionsGuard checks @Permissions(Permission.CREATE_RECEPTIONIST)
   └─ DOCTOR_ADMIN has CREATE_RECEPTIONIST permission ✓

    │
    ▼
4. Controller calls:
   - rbacService.requireClinicContext(user) ✓
   - usersService.createReceptionist(clinicId, dto, userId)

    │
    ▼
5. Service:
   - Validates email (no duplicates, not super admin)
   - Creates User account
   - Creates ClinicUser with role=RECEPTIONIST
   - Creates AuditLog entry

    │
    ▼
6. Response: 200 OK with created receptionist data
```

## Security Checks Performed

1. **Authentication** - JwtAuthGuard
   - Validates JWT signature
   - Checks expiration
   - Extracts user claims

2. **Role-Based Access** - RolesGuard
   - Checks if user has required role
   - Super Admin bypasses role checks

3. **Permission-Based Access** - PermissionsGuard
   - Checks if user has required permissions
   - Super Admin has all permissions

4. **Role Hierarchy** - RbacService
   - Validates users can only manage lower roles
   - Prevents privilege escalation

5. **Clinic Context** - RbacService
   - Ensures user belongs to clinic
   - Prevents cross-clinic access
   - Super Admin can access any clinic

6. **Audit Logging**
   - Records all admin operations
   - Includes timestamp, actor, action, metadata
   - Enables compliance and forensics

```

Perfect! The RBAC system is now fully implemented with:

✅ **Role Hierarchy**
- Super Admin (platform level)
- Doctor Admin (clinic manager)
- Doctor (medical professional)
- Receptionist (front desk)

✅ **Permission System**
- 19 granular permissions
- Role-to-permission mapping
- Permission checking in guards and services

✅ **Access Control**
- Role-based guards
- Permission-based guards
- Role-specific guards
- Clinic context validation

✅ **Security**
- Privilege escalation prevention
- Cross-clinic access prevention
- Comprehensive audit logging
- Multiple layers of validation

✅ **Documentation**
- Complete RBAC documentation
- Code examples for all scenarios
- Setup and testing guide
- Architecture diagrams

✅ **New Endpoints**
- `/users/receptionists` (POST/GET)
- `/users/staff` (GET)
- `/users/staff/:userId/status` (PATCH)
- `/clinics/:clinicId` (GET)
- `/clinics/:clinicId/status` (PATCH)

The system is production-ready and fully documented! 🎉
```
