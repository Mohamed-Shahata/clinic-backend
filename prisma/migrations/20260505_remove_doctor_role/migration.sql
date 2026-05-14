-- Migration: Remove DOCTOR role from ClinicRole enum
-- All existing DOCTOR users should be migrated to DOCTOR_ADMIN before running this

-- Step 1: Migrate any remaining DOCTOR users to DOCTOR_ADMIN
UPDATE "ClinicUser" SET role = 'DOCTOR_ADMIN' WHERE role = 'DOCTOR';

-- Step 2: Remove DOCTOR from the enum
-- PostgreSQL requires creating a new type and swapping
ALTER TYPE "ClinicRole" RENAME TO "ClinicRole_old";
CREATE TYPE "ClinicRole" AS ENUM ('DOCTOR_ADMIN', 'RECEPTIONIST');
ALTER TABLE "ClinicUser" ALTER COLUMN role TYPE "ClinicRole" USING role::text::"ClinicRole";
DROP TYPE "ClinicRole_old";
