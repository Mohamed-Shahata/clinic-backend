# RBAC System - Setup & Testing Guide

## Quick Setup

### 1. Create Super Admin User

```bash
# Use any authentication method to create a Super Admin user
# This user should have isSuperAdmin = true and no clinic membership
POST /auth/login
Body: {
  "email": "admin@platform.com",
  "password": "SecurePassword123"
  // No clinicSlug required for Super Admin
}
```

### 2. Super Admin Creates a Clinic

```bash
POST /clinics
Headers: {
  "Authorization": "Bearer <super-admin-token>"
}
Body: {
  "name": "Al-Ahly Medical Center",
  "slug": "alhly-medical",
  "timezone": "Africa/Cairo",
  "defaultLocale": "ar"
}
```

Response:

```json
{
  "id": "clinic_123",
  "name": "Al-Ahly Medical Center",
  "slug": "alhly-medical"
}
```

### 3. Create Clinic Admin (Doctor Admin)

```bash
POST /users/doctors
Headers: {
  "Authorization": "Bearer <clinic-admin-token>",
  "X-Clinic-Slug": "alhly-medical"
}
Body: {
  "email": "dr.admin@alhly.com",
  "fullName": "Dr. Ahmed Admin",
  "password": "DocAdminPass123",
  "specialty": "General Medicine"
}
```

### 4. Clinic Admin Creates Doctors

```bash
POST /users/doctors
Headers: {
  "Authorization": "Bearer <clinic-admin-token>",
  "X-Clinic-Slug": "alhly-medical"
}
Body: {
  "email": "dr.cardio@alhly.com",
  "fullName": "Dr. Mohamed Cardio",
  "password": "DoctorPass123",
  "specialty": "Cardiology"
}
```

### 5. Clinic Admin Creates Receptionist

```bash
POST /users/receptionists
Headers: {
  "Authorization": "Bearer <clinic-admin-token>",
  "X-Clinic-Slug": "alhly-medical"
}
Body: {
  "email": "reception@alhly.com",
  "fullName": "Fatima Reception",
  "password": "ReceptionPass123"
}
```

---

## Login Scenarios

### Scenario 1: Super Admin Login

```bash
POST /auth/login
Body: {
  "email": "admin@platform.com",
  "password": "SecurePassword123"
  // Note: clinicSlug is NOT provided
}
```

Response:

```json
{
  "accessToken": "jwt-token-here",
  "user": {
    "id": "user_1",
    "email": "admin@platform.com",
    "fullName": "Platform Admin",
    "isSuperAdmin": true,
    "clinicId": null,
    "clinicSlug": null,
    "clinicName": null,
    "role": null
  }
}
```

### Scenario 2: Clinic Admin Login

```bash
POST /auth/login
Body: {
  "email": "dr.admin@alhly.com",
  "password": "DocAdminPass123",
  "clinicSlug": "alhly-medical"
}
```

Response:

```json
{
  "accessToken": "jwt-token-here",
  "user": {
    "id": "user_2",
    "email": "dr.admin@alhly.com",
    "fullName": "Dr. Ahmed Admin",
    "isSuperAdmin": false,
    "clinicId": "clinic_123",
    "clinicSlug": "alhly-medical",
    "clinicName": "Al-Ahly Medical Center",
    "role": "DOCTOR_ADMIN"
  }
}
```

### Scenario 3: Doctor Login

```bash
POST /auth/login
Body: {
  "email": "dr.cardio@alhly.com",
  "password": "DoctorPass123",
  "clinicSlug": "alhly-medical"
}
```

Response:

```json
{
  "accessToken": "jwt-token-here",
  "user": {
    "id": "user_3",
    "email": "dr.cardio@alhly.com",
    "fullName": "Dr. Mohamed Cardio",
    "isSuperAdmin": false,
    "clinicId": "clinic_123",
    "clinicSlug": "alhly-medical",
    "clinicName": "Al-Ahly Medical Center",
    "role": "DOCTOR"
  }
}
```

### Scenario 4: Receptionist Login

```bash
POST /auth/login
Body: {
  "email": "reception@alhly.com",
  "password": "ReceptionPass123",
  "clinicSlug": "alhly-medical"
}
```

Response:

```json
{
  "accessToken": "jwt-token-here",
  "user": {
    "id": "user_4",
    "email": "reception@alhly.com",
    "fullName": "Fatima Reception",
    "isSuperAdmin": false,
    "clinicId": "clinic_123",
    "clinicSlug": "alhly-medical",
    "clinicName": "Al-Ahly Medical Center",
    "role": "RECEPTIONIST"
  }
}
```

---

## Access Control Testing

### Test 1: Super Admin Creates Clinic ✅

```bash
POST /clinics
Headers: Authorization: Bearer <super-admin-token>
# Should succeed
```

### Test 2: Doctor Cannot Create Clinic ❌

```bash
POST /clinics
Headers: Authorization: Bearer <doctor-token>
# Should fail with: ForbiddenException("Super Admin access required")
```

### Test 3: Clinic Admin Can Create Doctor ✅

```bash
POST /users/doctors
Headers: Authorization: Bearer <clinic-admin-token>
# Should succeed
```

### Test 4: Doctor Cannot Create Doctor ❌

```bash
POST /users/doctors
Headers: Authorization: Bearer <doctor-token>
# Should fail with: Insufficient role permission
```

### Test 5: Receptionist Cannot Create Doctor ❌

```bash
POST /users/doctors
Headers: Authorization: Bearer <receptionist-token>
# Should fail with: Insufficient role permission
```

### Test 6: Clinic Admin Can Create Receptionist ✅

```bash
POST /users/receptionists
Headers: Authorization: Bearer <clinic-admin-token>
# Should succeed
```

### Test 7: Doctor Can View Own Schedule ✅

```bash
GET /appointments
Headers: Authorization: Bearer <doctor-token>
# Should return doctor's appointments only
```

### Test 8: Receptionist Can Book Appointment ✅

```bash
POST /appointments
Headers: Authorization: Bearer <receptionist-token>
Body: { appointment data }
# Should succeed
```

### Test 9: Doctor Can Write Prescription ✅

```bash
POST /prescriptions
Headers: Authorization: Bearer <doctor-token>
Body: { prescription data }
# Should succeed
```

### Test 10: Receptionist Cannot Write Prescription ❌

```bash
POST /prescriptions
Headers: Authorization: Bearer <receptionist-token>
# Should fail with: Insufficient role permission
```

### Test 11: Receptionist Can Register Patient ✅

```bash
POST /patients
Headers: Authorization: Bearer <receptionist-token>
Body: { patient data }
# Should succeed
```

### Test 12: Receptionist Cannot View Patient History ❌

```bash
GET /prescriptions/patient/:patientId/history
Headers: Authorization: Bearer <receptionist-token>
# Should fail - receptionists don't have VIEW_PATIENT_HISTORY permission
```

### Test 13: Doctor Can View Patient History ✅

```bash
GET /prescriptions/patient/:patientId/history
Headers: Authorization: Bearer <doctor-token>
# Should succeed
```

### Test 14: Clinic Admin Can View Reports ✅

```bash
GET /clinic/reports
Headers: Authorization: Bearer <clinic-admin-token>
# Should succeed
```

### Test 15: Doctor Cannot View Reports ❌

```bash
GET /clinic/reports
Headers: Authorization: Bearer <doctor-token>
# Should fail with: Insufficient role permission
```

---

## Permission Verification Checklist

### Super Admin Permissions

- [ ] Can create clinics
- [ ] Can view platform statistics
- [ ] Can disable/enable clinic subscriptions
- [ ] Cannot access clinic-specific features

### Clinic Admin (Doctor Admin) Permissions

- [ ] Can create/manage doctors
- [ ] Can create/manage receptionists
- [ ] Can update clinic settings
- [ ] Can view clinic reports
- [ ] Can view clinic financials
- [ ] Can write prescriptions (doctor capability)
- [ ] Can view patient history (doctor capability)
- [ ] Cannot access other clinics

### Doctor Permissions

- [ ] Can view own appointments
- [ ] Can write prescriptions
- [ ] Can view patient history
- [ ] Can request tests
- [ ] Cannot manage staff
- [ ] Cannot update clinic settings
- [ ] Cannot view other doctors' appointments

### Receptionist Permissions

- [ ] Can register patients
- [ ] Can book appointments
- [ ] Can cancel appointments
- [ ] Can process billing
- [ ] Can view clinic schedule
- [ ] Cannot write prescriptions
- [ ] Cannot view patient medical history
- [ ] Cannot manage staff

---

## Audit Log Verification

Check that actions are properly logged:

```bash
# Check audit logs (requires admin endpoint)
GET /audit-logs?clinicId=clinic_123
```

Expected logs:

```json
[
  {
    "action": "CLINIC_CREATED",
    "actorId": "super-admin-id",
    "entityType": "Clinic"
  },
  {
    "action": "CLINIC_DOCTOR_CREATED",
    "actorId": "clinic-admin-id",
    "entityType": "User"
  },
  {
    "action": "CLINIC_RECEPTIONIST_CREATED",
    "actorId": "clinic-admin-id",
    "entityType": "User"
  }
]
```

---

## Common Issues & Solutions

### Issue: Receptionist Can Access Medical Data

**Solution:** Add `@Permissions(Permission.VIEW_PATIENT_HISTORY)` to medical endpoints

### Issue: User Can Create Higher Role

**Solution:** Use `rbacService.requireRoleManagement()` to validate

### Issue: Doctor Can Access Other Clinic

**Solution:** Always check `clinicId` matches with `user.clinicId`

### Issue: Super Admin Token Expires

**Solution:** Super Admin tokens are valid platform-wide, refresh as needed

---

## Database Seed Data

Add this to `prisma/seed.ts` for testing:

```typescript
async function main() {
  // Create Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      email: "admin@platform.com",
      fullName: "Platform Admin",
      passwordHash: await hash("AdminPass123", 10),
      isSuperAdmin: true,
    },
  });

  // Create Clinic
  const clinic = await prisma.clinic.create({
    data: {
      name: "Al-Ahly Medical Center",
      slug: "alhly-medical",
      timezone: "Africa/Cairo",
      defaultLocale: "ar",
    },
  });

  // Create Clinic Admin
  const clinicAdmin = await prisma.user.create({
    data: {
      email: "dr.admin@alhly.com",
      fullName: "Dr. Ahmed Admin",
      passwordHash: await hash("DocAdminPass123", 10),
      isSuperAdmin: false,
    },
  });

  await prisma.clinicUser.create({
    data: {
      clinicId: clinic.id,
      userId: clinicAdmin.id,
      role: "DOCTOR_ADMIN",
      specialty: "General Medicine",
      isActive: true,
    },
  });

  // Create Doctor
  const doctor = await prisma.user.create({
    data: {
      email: "dr.cardio@alhly.com",
      fullName: "Dr. Mohamed Cardio",
      passwordHash: await hash("DoctorPass123", 10),
      isSuperAdmin: false,
    },
  });

  await prisma.clinicUser.create({
    data: {
      clinicId: clinic.id,
      userId: doctor.id,
      role: "DOCTOR",
      specialty: "Cardiology",
      isActive: true,
    },
  });

  // Create Receptionist
  const receptionist = await prisma.user.create({
    data: {
      email: "reception@alhly.com",
      fullName: "Fatima Reception",
      passwordHash: await hash("ReceptionPass123", 10),
      isSuperAdmin: false,
    },
  });

  await prisma.clinicUser.create({
    data: {
      clinicId: clinic.id,
      userId: receptionist.id,
      role: "RECEPTIONIST",
      isActive: true,
    },
  });

  console.log("Seed data created successfully!");
}
```

Run seed:

```bash
npx prisma db seed
```

---

## Performance Tips

1. **Index clinic user queries**

   ```prisma
   @@index([clinicId, role])
   @@index([userId, clinicId])
   ```

2. **Cache role permissions** in user session
3. **Use select() to minimize data retrieval**
4. **Batch audit log writes** if high volume

---

## Next Steps

1. Implement remaining endpoints for patients, appointments, billing
2. Add detailed permission checks in service layer
3. Create admin dashboard for role management
4. Set up audit log viewer interface
5. Add role assignment workflows
