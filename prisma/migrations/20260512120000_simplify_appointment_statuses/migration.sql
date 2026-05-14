UPDATE "Appointment"
SET "status" = 'IN_QUEUE'
WHERE "status" IN ('BOOKED', 'CHECKED_IN');

UPDATE "Appointment"
SET "status" = 'CANCELLED'
WHERE "status" = 'NO_SHOW';

ALTER TYPE "AppointmentStatus" RENAME TO "AppointmentStatus_old";

CREATE TYPE "AppointmentStatus" AS ENUM (
  'IN_QUEUE',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "Appointment"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "AppointmentStatus"
  USING "status"::text::"AppointmentStatus",
  ALTER COLUMN "status" SET DEFAULT 'IN_QUEUE';

DROP TYPE "AppointmentStatus_old";
