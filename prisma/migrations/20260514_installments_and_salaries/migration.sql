-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- CreateTable: InstallmentPlan
CREATE TABLE "InstallmentPlan" (
    "id"            TEXT NOT NULL,
    "clinicId"      TEXT NOT NULL,
    "patientId"     TEXT NOT NULL,
    "appointmentId" TEXT,
    "createdById"   TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "totalAmount"   DECIMAL(12,2) NOT NULL,
    "paidAmount"    DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status"        "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstallmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InstallmentPayment
CREATE TABLE "InstallmentPayment" (
    "id"         TEXT NOT NULL,
    "planId"     TEXT NOT NULL,
    "amount"     DECIMAL(12,2) NOT NULL,
    "note"       TEXT,
    "paidAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT NOT NULL,
    CONSTRAINT "InstallmentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StaffSalary
CREATE TABLE "StaffSalary" (
    "id"            TEXT NOT NULL,
    "clinicId"      TEXT NOT NULL,
    "clinicUserId"  TEXT NOT NULL,
    "monthlyAmount" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffSalary_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SalaryPayment
CREATE TABLE "SalaryPayment" (
    "id"       TEXT NOT NULL,
    "salaryId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "amount"   DECIMAL(12,2) NOT NULL,
    "paidAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note"     TEXT,
    "paidById" TEXT NOT NULL,
    CONSTRAINT "SalaryPayment_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys: InstallmentPlan
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE;
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE;
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL;

-- Foreign Keys: InstallmentPayment
ALTER TABLE "InstallmentPayment" ADD CONSTRAINT "InstallmentPayment_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "InstallmentPlan"("id") ON DELETE CASCADE;

-- Foreign Keys: StaffSalary
ALTER TABLE "StaffSalary" ADD CONSTRAINT "StaffSalary_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE;
ALTER TABLE "StaffSalary" ADD CONSTRAINT "StaffSalary_clinicUserId_fkey"
  FOREIGN KEY ("clinicUserId") REFERENCES "ClinicUser"("id") ON DELETE CASCADE;

-- Foreign Keys: SalaryPayment
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_salaryId_fkey"
  FOREIGN KEY ("salaryId") REFERENCES "StaffSalary"("id") ON DELETE CASCADE;
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE;

-- Indexes
CREATE INDEX "InstallmentPlan_clinicId_patientId_idx" ON "InstallmentPlan"("clinicId","patientId");
CREATE INDEX "InstallmentPlan_clinicId_status_idx" ON "InstallmentPlan"("clinicId","status");
CREATE INDEX "InstallmentPlan_appointmentId_idx" ON "InstallmentPlan"("appointmentId");
CREATE INDEX "InstallmentPayment_planId_paidAt_idx" ON "InstallmentPayment"("planId","paidAt");
CREATE INDEX "StaffSalary_clinicId_clinicUserId_idx" ON "StaffSalary"("clinicId","clinicUserId");
CREATE INDEX "SalaryPayment_salaryId_paidAt_idx" ON "SalaryPayment"("salaryId","paidAt");
CREATE INDEX "SalaryPayment_clinicId_idx" ON "SalaryPayment"("clinicId");
