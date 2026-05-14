CREATE TYPE "DoctorPaymentMode" AS ENUM ('FIXED_RENT', 'PERCENTAGE');

ALTER TABLE "ClinicUser"
  ADD COLUMN "paymentMode" "DoctorPaymentMode",
  ADD COLUMN "fixedMonthlyRent" DECIMAL(12, 2),
  ADD COLUMN "adminPercentage" DECIMAL(5, 2);

CREATE TABLE "MedicationCatalog" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dose" TEXT,
  "frequency" TEXT,
  "duration" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MedicationCatalog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImagingCatalog" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImagingCatalog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrescriptionTemplate" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "header" JSONB,
  "footer" JSONB,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrescriptionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MedicationCatalog_clinicId_doctorId_name_idx" ON "MedicationCatalog"("clinicId", "doctorId", "name");
CREATE INDEX "ImagingCatalog_clinicId_doctorId_name_idx" ON "ImagingCatalog"("clinicId", "doctorId", "name");
CREATE INDEX "PrescriptionTemplate_clinicId_doctorId_idx" ON "PrescriptionTemplate"("clinicId", "doctorId");

ALTER TABLE "MedicationCatalog" ADD CONSTRAINT "MedicationCatalog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImagingCatalog" ADD CONSTRAINT "ImagingCatalog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrescriptionTemplate" ADD CONSTRAINT "PrescriptionTemplate_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
