-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('BUG', 'FEATURE', 'PERFORMANCE', 'UX', 'BILLING', 'OTHER');

-- DropForeignKey
ALTER TABLE "InstallmentPayment" DROP CONSTRAINT "InstallmentPayment_planId_fkey";

-- DropForeignKey
ALTER TABLE "InstallmentPlan" DROP CONSTRAINT "InstallmentPlan_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "InstallmentPlan" DROP CONSTRAINT "InstallmentPlan_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "InstallmentPlan" DROP CONSTRAINT "InstallmentPlan_patientId_fkey";

-- DropForeignKey
ALTER TABLE "SalaryPayment" DROP CONSTRAINT "SalaryPayment_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "SalaryPayment" DROP CONSTRAINT "SalaryPayment_salaryId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceCatalog" DROP CONSTRAINT "ServiceCatalog_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "StaffSalary" DROP CONSTRAINT "StaffSalary_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "StaffSalary" DROP CONSTRAINT "StaffSalary_clinicUserId_fkey";

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ServiceCatalog" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "category" "ComplaintCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "adminReply" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteRating" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "ease" INTEGER NOT NULL,
    "features" INTEGER NOT NULL,
    "support" INTEGER NOT NULL,
    "comment" TEXT,
    "wouldRefer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Complaint_clinicId_status_createdAt_idx" ON "Complaint"("clinicId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_submittedBy_createdAt_idx" ON "Complaint"("submittedBy", "createdAt");

-- CreateIndex
CREATE INDEX "SiteRating_createdAt_idx" ON "SiteRating"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteRating_clinicId_submittedBy_key" ON "SiteRating"("clinicId", "submittedBy");

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPayment" ADD CONSTRAINT "InstallmentPayment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InstallmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalary" ADD CONSTRAINT "StaffSalary_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalary" ADD CONSTRAINT "StaffSalary_clinicUserId_fkey" FOREIGN KEY ("clinicUserId") REFERENCES "ClinicUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_salaryId_fkey" FOREIGN KEY ("salaryId") REFERENCES "StaffSalary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCatalog" ADD CONSTRAINT "ServiceCatalog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteRating" ADD CONSTRAINT "SiteRating_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
