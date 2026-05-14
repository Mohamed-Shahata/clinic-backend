# Clinic CMS — Backend API

> A production-ready multi-tenant SaaS REST API for managing medical clinics, built with NestJS, PostgreSQL, and Prisma ORM.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Database Design](#database-design)
- [Authentication & Authorization](#authentication--authorization)
- [API Reference](#api-reference)
- [Appointment State Machine](#appointment-state-machine)
- [Billing & Earnings System](#billing--earnings-system)
- [Subscription Management](#subscription-management)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Seed Data](#seed-data)

---

## Project Overview

Clinic CMS is a **multi-tenant SaaS platform** that enables medical clinics to fully digitize their operations. Each clinic is an isolated tenant with its own doctors, receptionists, patients, and billing — all managed through a clean REST API.

The platform serves three distinct user roles:

- **Doctor Admin** — manages the clinic end-to-end: patients, appointments, prescriptions, billing, and staff
- **Receptionist** — handles front-desk tasks: scheduling appointments, registering patients, and issuing invoices
- **Super Admin** — platform-level operator: creates clinics, manages subscriptions, reviews payment requests, and monitors all activity

---

## Key Features

- **Multi-tenancy** — strict data isolation per clinic enforced at every query level
- **Role-based access control (RBAC)** — three roles with fine-grained permissions enforced via NestJS guards and custom decorators
- **Live appointment queue** — real-time patient queue with a 7-state status machine (BOOKED → IN_PROGRESS → COMPLETED)
- **Prescription engine** — structured prescriptions with medications, lab test requests, and imaging orders stored as validated JSON
- **Doctor-specific catalogs** — each doctor maintains their own reusable medication and imaging catalogs for fast prescription writing
- **Dual earning models** — clinic admins configure doctor compensation as either a fixed monthly rent or a percentage of revenue
- **Subscription lifecycle** — full payment-proof request and approval flow with super-admin review, automatic expiry extension, and referral bonuses
- **File attachments** — patient document uploads via Cloudinary with metadata stored in PostgreSQL
- **Audit logging** — every write operation is logged with actor, action, entity, and metadata for full traceability
- **In-app notifications** — event-driven notifications for subscription changes, delivered to relevant users
- **Email OTP flows** — password reset and email-change secured with time-limited OTP codes via Nodemailer
- **Stale appointment cleanup** — automatic cancellation of past-day unresolved appointments on every queue fetch

---

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| **NestJS** | 10.x | Core framework — modular, dependency-injected architecture |
| **TypeScript** | 5.x | Fully typed codebase end-to-end |
| **PostgreSQL** | 15+ | Primary relational database |
| **Prisma ORM** | 5.x | Type-safe database client, schema management, and migrations |
| **JWT** | — | Stateless authentication tokens |
| **Passport.js** | 0.7.x | Authentication middleware (JWT strategy) |
| **bcryptjs** | 2.x | Password hashing with configurable salt rounds |
| **Cloudinary** | 2.x | Cloud storage for patient file attachments |
| **Nodemailer** | 6.x | Transactional email delivery (OTP, notifications) |

---

## Architecture

The backend follows **NestJS modular architecture** — each business domain is encapsulated in its own module with a controller, service, and DTOs. Cross-cutting concerns (auth, database, mail, uploads) live in a dedicated `core/` layer shared across all modules.

```
HTTP Request
     │
     ▼
 Global Middleware (Logger, CORS)
     │
     ▼
 Guards  ──→  JwtAuthGuard  ──→  ClinicContextGuard  ──→  RolesGuard
     │
     ▼
 Controller  (DTO validation via class-validator + class-transformer)
     │
     ▼
 Service  (business logic, domain rules, side-effects)
     │
     ▼
 Prisma Client  ──→  PostgreSQL
```

**Key design decisions:**

- The JWT payload carries `userId`, `clinicId`, `role`, and `isSuperAdmin` — avoiding a database round-trip on most requests
- Every service method that touches clinic data receives `clinicId` from the guard-hydrated `RequestUser` — no endpoint can access another clinic's data
- Audit logs are written as fire-and-forget side-effects inside service methods, not as middleware, so they carry full business context
- `$transaction` is used for any multi-table write that must be atomic (e.g., creating a clinic + admin user + subscription in one operation)

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma           # All models, relations, enums, and indexes
│   ├── seed.ts                 # Comprehensive seed covering all scenarios
│   └── migrations/             # Versioned migration history
│
└── src/
    ├── main.ts                 # Bootstrap, CORS, global pipes & filters
    ├── app.module.ts           # Root module — wires all feature modules
    │
    ├── core/                   # Shared infrastructure (not business logic)
    │   ├── auth/
    │   │   ├── auth.controller.ts     # Login, OTP, password management endpoints
    │   │   ├── auth.service.ts        # Token generation, OTP store, credential validation
    │   │   ├── jwt.strategy.ts        # Passport JWT strategy — payload extraction
    │   │   ├── guards/
    │   │   │   ├── jwt-auth.guard.ts          # Verifies JWT, hydrates req.user
    │   │   │   ├── roles.guard.ts             # Enforces @Roles() decorator
    │   │   │   └── clinic-context.guard.ts    # Ensures clinicId present for clinic routes
    │   │   ├── decorators/
    │   │   │   ├── roles.decorator.ts         # @Roles(ClinicRole.DOCTOR_ADMIN)
    │   │   │   ├── current-user.decorator.ts  # @CurrentUser() param decorator
    │   │   │   └── public.decorator.ts        # @Public() skips JWT guard
    │   │   └── types/
    │   │       ├── request-user.type.ts       # RequestUser interface
    │   │       └── jwt-payload.type.ts        # JwtPayload interface
    │   │
    │   ├── database/
    │   │   └── prisma.service.ts      # PrismaClient singleton with onModuleInit/Destroy
    │   │
    │   ├── mail/
    │   │   └── mail.service.ts        # Nodemailer wrapper with HTML email templates
    │   │
    │   └── upload/
    │       └── upload.service.ts      # Cloudinary upload — signed URLs, deletion
    │
    └── modules/                # Feature modules (one per business domain)
        ├── appointments/
        │   ├── appointments.controller.ts
        │   ├── appointments.service.ts    # Queue logic, status machine, stale cleanup
        │   └── dto/                       # CreateAppointmentDto, UpdateAppointmentDto
        │
        ├── billing/
        │   ├── billing.controller.ts
        │   ├── billing.service.ts         # Invoices, earnings calc, subscription flow
        │   └── dto/
        │
        ├── clinics/
        │   ├── clinics.controller.ts
        │   ├── clinics.service.ts         # Clinic CRUD, working hours, stats
        │   └── dto/
        │
        ├── notifications/
        │   ├── notifications.controller.ts
        │   └── notifications.service.ts   # createForUser, read/unread management
        │
        ├── patients/
        │   ├── patients.controller.ts
        │   ├── patients.service.ts        # Patient CRUD, search, attachments
        │   └── dto/
        │
        ├── prescriptions/
        │   ├── prescriptions.controller.ts
        │   ├── prescriptions.service.ts   # Prescriptions + medication/imaging catalogs
        │   └── dto/
        │
        └── users/
            ├── users.controller.ts
            ├── users.service.ts           # Staff management, payment configuration
            └── dto/
```

---

## Database Design

The schema is designed around the **clinic as the central tenant boundary**. Every table that holds clinical data has a `clinicId` foreign key, and all queries are scoped to it — making cross-tenant data leakage structurally impossible at the query level.

### Entity Relationship Overview

```
User ──────────── ClinicUser ──────────── Clinic
                  (role, payment)        (slug, workingHours, locale)
                                              │
              ┌───────────────────────────────┼────────────────────────┐
              │                               │                        │
           Patient                      Appointment               Prescription
         (code, notes)               (status, visitType)        (medications JSON)
              │                               │
    PatientAttachment                      Invoice
    (Cloudinary key)                  (services JSON)

Clinic ─── ClinicSubscription ─── SubscriptionPlan
       └── SubscriptionPaymentRequest

User ──── Notification
Clinic ── AuditLog
```

### Models Reference

| Model | Key Fields | Notes |
|-------|-----------|-------|
| `User` | `email`, `phone`, `isSuperAdmin`, `passwordHash` | Can belong to multiple clinics via `ClinicUser` |
| `Clinic` | `slug` (unique), `workingHours` (JSON), `defaultLocale` | Slug doubles as referral code |
| `ClinicUser` | `role`, `paymentMode`, `fixedMonthlyRent`, `adminPercentage` | Unique constraint on `[clinicId, userId]` |
| `Patient` | `code` (clinic-scoped unique), `medicalNotes`, `dateOfBirth` | Code is auto-sequential per clinic |
| `Appointment` | `status` (7 values), `visitType`, `startsAt`, `endsAt` | `doctorId` links to `User` (not `ClinicUser`) |
| `Prescription` | `medications` (JSON), `diagnosis` | JSON stores meds array + requestedTests + requestedImaging |
| `Invoice` | `services` (JSON), `paymentMethod`, `totalAmount` | Can be linked to an appointment or standalone |
| `ClinicSubscription` | `startsAt`, `expiresAt`, `status` | One per clinic, upserted on approval |
| `AuditLog` | `action`, `entityType`, `entityId`, `meta` (JSON) | Append-only, never updated |

---

## Authentication & Authorization

### Login Flow

```
POST /api/auth/login  { login: "email or phone", password: "..." }
        │
        ▼
  Normalize input (email → lowercase / phone → strip formatting)
        │
        ▼
  Find user by email OR phone (handles both stored formats)
        │
        ▼
  bcrypt.compare(password, passwordHash)
        │
        ▼
  Verify clinic is active (for clinic-scoped users)
        │
        ▼
  Sign JWT  { userId, clinicId, role, isSuperAdmin, exp }
        │
        ▼
  Return  { access_token, user: { id, fullName, email, role, clinic } }
```

### Password Reset Flow (OTP)

```
POST /forgot-password/request  { email }
  → Generate 6-digit OTP, store in-memory with 10-min TTL
  → Send HTML email with OTP

POST /forgot-password/reset  { email, code, newPassword }
  → Validate OTP (code match + not expired)
  → bcrypt.hash(newPassword) → update DB → invalidate OTP
```

### Authorization Layers

| Layer | Guard | What it does |
|-------|-------|-------------|
| 1 | `JwtAuthGuard` | Verifies JWT signature, decodes payload into `req.user` |
| 2 | `ClinicContextGuard` | Rejects requests without `clinicId` on clinic-scoped routes |
| 3 | `RolesGuard` | Compares `req.user.role` against `@Roles()` on the handler |

### Role Permission Matrix

| Capability | SUPER_ADMIN | DOCTOR_ADMIN | RECEPTIONIST |
|-----------|:-----------:|:------------:|:------------:|
| Manage all clinics | ✓ | — | — |
| Review subscription requests | ✓ | — | — |
| Extend subscriptions manually | ✓ | — | — |
| View platform user directory | ✓ | — | — |
| Write prescriptions | — | ✓ | — |
| Access patient medical notes | — | ✓ | — |
| Configure doctor payment mode | — | ✓ | — |
| Manage clinic staff | — | ✓ | — |
| View doctor earnings reports | — | ✓ | — |
| Book & manage appointments | — | ✓ | ✓ |
| Register & search patients | — | ✓ | ✓ |
| Issue invoices | — | ✓ | ✓ |
| Update clinic settings | — | ✓ | — |

---

## API Reference

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/login` | Public | Sign in with email or phone + password |
| POST | `/forgot-password/request` | Public | Send OTP to registered email |
| POST | `/forgot-password/reset` | Public | Reset password using OTP |
| POST | `/request-email-change` | JWT | Request email change (sends OTP to new address) |
| POST | `/confirm-email-change` | JWT | Confirm email change with OTP |
| PATCH | `/change-password` | JWT | Change password for the authenticated user |

### Appointments — `/api/appointments`

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/` | All | List appointments for a day — filter by `date`, `status`, `doctorId` |
| GET | `/queue` | Doctor | Live patient queue for today (active statuses only) |
| POST | `/` | All | Create appointment (walk-in or scheduled with conflict check) |
| PATCH | `/:id` | All | Update appointment — patient, doctor, time slot, notes |
| PATCH | `/:id/status` | All | Advance appointment through the state machine |
| DELETE | `/:id` | All | Delete appointment (today's only, non-terminal status) |

### Patients — `/api/patients`

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/` | All | List / search patients by name, code, or phone |
| GET | `/:id` | All | Full patient profile with appointment and prescription history |
| POST | `/` | All | Register a new patient with auto-generated code |
| PATCH | `/:id` | All | Update patient details or medical notes |
| POST | `/:id/attachments` | All | Upload file to Cloudinary, store metadata in DB |
| DELETE | `/:id/attachments/:aId` | All | Remove attachment from Cloudinary and DB |

### Prescriptions — `/api/prescriptions`

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/patient/:patientId` | Doctor | All prescriptions for a patient, newest first |
| POST | `/` | Doctor | Create prescription with medications, tests, imaging |
| GET | `/catalog/medications` | Doctor | Doctor's reusable medication catalog |
| POST | `/catalog/medications` | Doctor | Add medication entry to personal catalog |
| PATCH | `/catalog/medications/:id` | Doctor | Update catalog entry |
| DELETE | `/catalog/medications/:id` | Doctor | Remove entry from catalog |
| GET | `/catalog/imaging` | Doctor | Doctor's reusable imaging catalog |
| POST | `/catalog/imaging` | Doctor | Add imaging item to catalog |
| PATCH | `/catalog/imaging/:id` | Doctor | Update imaging catalog entry |
| DELETE | `/catalog/imaging/:id` | Doctor | Remove imaging item |
| GET | `/template` | Doctor | Get active prescription print template |
| POST | `/template` | Doctor | Save prescription print template (header, footer, logo) |

### Billing — `/api/billing`

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/invoices` | All | All clinic invoices ordered by date |
| POST | `/invoices` | All | Issue invoice with line-item services JSON |
| PATCH | `/invoices/:id` | All | Edit invoice (doctors: own invoices only) |
| DELETE | `/invoices/:id` | All | Delete invoice (doctors: own invoices only) |
| GET | `/doctor-earnings` | Doctor | Earnings per doctor with deduction breakdown |
| GET | `/doctor-monthly-stats` | Doctor | Monthly revenue, patient count, daily chart data |
| GET | `/subscription` | Doctor | Current subscription plan and expiry |
| GET | `/subscription-plans` | Doctor | Available plans for renewal |
| POST | `/subscription-requests` | Doctor | Submit payment proof (screenshot + transfer phone) |
| GET | `/subscription-requests` | Super | List all payment requests across all clinics |
| PATCH | `/subscription-requests/:id/review` | Super | Approve or reject a payment request |
| POST | `/extend-subscription` | Super | Manually extend one or all clinic subscriptions |

### Clinics — `/api/clinics`

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/` | Super | All clinics with subscription status and user counts |
| POST | `/` | Super | Create clinic + admin user + subscription in one transaction |
| GET | `/stats` | Doctor | Clinic stats: total patients, appointments, revenue |
| GET | `/:id` | Super | Full clinic detail |
| PATCH | `/:id/status` | Super | Toggle clinic active/inactive |
| PATCH | `/settings` | Doctor | Update clinic name, working hours (JSON), logo URL |

### Users — `/api/users`

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/me/profile` | All | Authenticated user's profile and clinic context |
| PATCH | `/me/profile` | All | Update display name, avatar, contact info |
| GET | `/staff` | Doctor | All active and inactive staff in the clinic |
| GET | `/doctors` | All | Doctors list (for appointment doctor selector) |
| GET | `/receptionists` | Doctor | Receptionists in the clinic |
| POST | `/receptionists` | Doctor | Create new receptionist account |
| PATCH | `/staff/:id/status` | Doctor | Activate or deactivate a staff member |
| DELETE | `/staff/:id` | Doctor | Remove staff member from clinic |
| PATCH | `/doctors/:id/payment` | Doctor | Set payment mode (FIXED_RENT / PERCENTAGE) and rates |
| GET | `/platform-directory` | Super | Full user directory across all clinics with filters |

### Notifications — `/api/notifications`

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/` | All | All notifications for the authenticated user |
| GET | `/unread-count` | All | Number of unread notifications |
| PATCH | `/:id/read` | All | Mark single notification as read |
| PATCH | `/mark-all-read` | All | Mark all notifications as read |

---

## Appointment State Machine

Appointments follow a strict state machine reflecting the real clinic workflow. Invalid transitions are rejected with a `400 Bad Request`.

```
                   ┌──────────┐
                   │  BOOKED  │  ← future scheduled appointment
                   └────┬─────┘
                        │  patient arrives
                        ▼
                  ┌───────────┐
                  │ CHECKED_IN│  ← physical presence confirmed
                  └─────┬─────┘
                        │  added to queue
                        ▼
┌─────────────┐   ┌──────────┐
│  Walk-in    │──>│ IN_QUEUE │  ← waiting to be seen
│  (no BOOKED)│   └─────┬────┘
└─────────────┘         │  doctor calls patient
                        ▼
                  ┌─────────────┐
                  │ IN_PROGRESS │  ← currently in examination
                  └──────┬──────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
       ┌─────────┐             ┌───────────┐
       │COMPLETED│             │ CANCELLED │
       └─────────┘             └───────────┘

  NO_SHOW — can be set from any pre-examination status
  CANCELLED — can be set from IN_QUEUE or IN_PROGRESS
  Past-day unresolved (BOOKED/CHECKED_IN/IN_QUEUE) → auto-CANCELLED on next fetch
```

---

## Billing & Earnings System

### Invoice Structure

Each invoice stores line items as a JSON array for maximum flexibility:

```json
{
  "services": [
    { "name": "Consultation fee", "amount": 300 },
    { "name": "ECG", "amount": 150 }
  ],
  "paymentMethod": "cash | card | insurance",
  "totalAmount": 450,
  "status": "PAID"
}
```

Invoices can be linked to an appointment (`appointmentId`) or issued as standalone walk-in invoices.

### Doctor Compensation Models

| Mode | Logic |
|------|-------|
| `FIXED_RENT` | Doctor pays a flat monthly fee to the clinic — no per-visit deduction |
| `PERCENTAGE` | A percentage of each invoice total is deducted and counted as clinic admin revenue |

The `/billing/doctor-earnings` endpoint computes gross revenue, total deductions, and net earnings per doctor. The `DOCTOR_ADMIN` also receives a full per-invoice breakdown with individual deduction amounts.

---

## Subscription Management

The platform uses a **payment-proof workflow** for subscription renewals, designed for markets where automatic online payment collection is not always practical.

```
Doctor submits payment proof
  POST /billing/subscription-requests
  { planId, transferPhone, screenshotUrl, notes? }
        │
        ▼
  SubscriptionPaymentRequest created  (status: PENDING)
  Super-admins notified via in-app notification
        │
        ▼
  Super Admin reviews in dashboard
  PATCH /billing/subscription-requests/:id/review
  { approved: true | false, rejectionReason? }
        │
        ├── APPROVED
        │     → ClinicSubscription upserted
        │       (extends from current expiresAt if still active,
        │        or from today if already expired)
        │     → Doctor notified: "Subscription activated"
        │
        └── REJECTED
              → rejectionReason stored on request
              → Doctor notified: "Subscription request rejected"
```

**Manual extension** (Super Admin): `POST /billing/extend-subscription` adds N days to one or all clinic subscriptions — useful for trials, support credits, or bulk operations.

**Referral bonus**: when a new clinic is created with a `referralCode` matching another clinic's slug, the referring clinic receives a 10-day free extension automatically.

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Cloudinary account (free tier sufficient)
- SMTP credentials (Gmail app password works)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, Cloudinary, and mail credentials

# 3. Run database migrations
npx prisma migrate dev

# 4. Seed demo data
npx prisma db seed

# 5. Start development server
npm run start:dev
# → http://localhost:3001/api
```

### Scripts

```bash
npm run start:dev      # Development server with hot-reload (ts-node + watch)
npm run build          # Compile TypeScript to dist/
npm run start:prod     # Run compiled production build
npx prisma studio      # Open Prisma GUI for database inspection
npx prisma migrate dev # Apply pending migrations + regenerate client
npx prisma db seed     # Run seed.ts to populate demo data
```

---

## Environment Variables

```env
# ── Database ──────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/clinic_db

# ── Auth ──────────────────────────────────────────────────
JWT_SECRET=your-secure-random-secret-minimum-32-characters

# ── App ───────────────────────────────────────────────────
FRONTEND_URL=http://localhost:3000      # Used for CORS and email links

# ── Cloudinary (file uploads) ─────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ── Mail (SMTP) ───────────────────────────────────────────
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your@email.com
MAIL_PASS=your_gmail_app_password
MAIL_FROM="Clinic CMS <noreply@cliniccms.com>"
```

---

## Seed Data

Run `npx prisma db seed` to populate the database with realistic demo data covering every application scenario.

**All accounts share the password: `Password123!`**

| Name | Email | Role | Clinic |
|------|-------|------|--------|
| Platform Super Admin | `super@demo.test` | Super Admin | — |
| Dr. Ahmed Salem | `dr.alpha@demo.test` | Doctor Admin | Alpha Clinic — active subscription, 20% revenue share |
| Mai Abdullah | `rec.alpha@demo.test` | Receptionist | Alpha Clinic |
| Dr. Mona Khaled | `dr.beta@demo.test` | Doctor Admin | Beta Clinic — expired subscription, fixed rent |

**Scenarios covered by the seed:**

| Category | What's seeded |
|----------|--------------|
| Clinics | 2 clinics: active subscription vs. expired; percentage vs. fixed-rent payment |
| Subscription plans | Monthly, 6-month, yearly (active) + 1 legacy disabled plan |
| Patients | 7 patients per clinic — full data, missing phone, no notes, elderly, walk-in, emergency |
| Appointments | All 7 statuses — today (queue, in-progress, completed, cancelled) + future + historical |
| Prescriptions | With full medications + tests; tests/imaging only; historical |
| Invoices | Cash, card, and insurance; appointment-linked and standalone walk-in |
| Subscription requests | PENDING (awaiting review), APPROVED, and REJECTED with reason |
| Catalogs | Medication and imaging catalogs per doctor + prescription print template |
| Notifications | Read and unread, all notification types |
| Audit logs | 8 entries covering all major event types |
