CREATE TYPE "SubscriptionPeriod" AS ENUM ('MONTHLY', 'SIX_MONTHS', 'YEARLY');
CREATE TYPE "SubscriptionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "User" ADD COLUMN "phone" TEXT;
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

ALTER TABLE "ClinicUser" ADD COLUMN "subscriptionPeriod" "SubscriptionPeriod";

CREATE TABLE "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "code" "SubscriptionPeriod" NOT NULL,
  "name" TEXT NOT NULL,
  "durationDays" INTEGER NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");

CREATE TABLE "ClinicSubscription" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicSubscription_clinicId_key" ON "ClinicSubscription"("clinicId");
CREATE INDEX "ClinicSubscription_status_expiresAt_idx" ON "ClinicSubscription"("status", "expiresAt");

CREATE TABLE "SubscriptionPaymentRequest" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "transferPhone" TEXT NOT NULL,
  "screenshotUrl" TEXT NOT NULL,
  "notes" TEXT,
  "status" "SubscriptionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionPaymentRequest_clinicId_status_createdAt_idx" ON "SubscriptionPaymentRequest"("clinicId", "status", "createdAt");
CREATE INDEX "SubscriptionPaymentRequest_status_createdAt_idx" ON "SubscriptionPaymentRequest"("status", "createdAt");

ALTER TABLE "ClinicSubscription" ADD CONSTRAINT "ClinicSubscription_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicSubscription" ADD CONSTRAINT "ClinicSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPaymentRequest" ADD CONSTRAINT "SubscriptionPaymentRequest_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPaymentRequest" ADD CONSTRAINT "SubscriptionPaymentRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPaymentRequest" ADD CONSTRAINT "SubscriptionPaymentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPaymentRequest" ADD CONSTRAINT "SubscriptionPaymentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "SubscriptionPlan" ("id", "code", "name", "durationDays", "price", "updatedAt")
VALUES
  ('plan_monthly', 'MONTHLY', 'Monthly', 30, 0, CURRENT_TIMESTAMP),
  ('plan_six_months', 'SIX_MONTHS', 'Six months', 180, 0, CURRENT_TIMESTAMP),
  ('plan_yearly', 'YEARLY', 'Yearly', 365, 0, CURRENT_TIMESTAMP);
