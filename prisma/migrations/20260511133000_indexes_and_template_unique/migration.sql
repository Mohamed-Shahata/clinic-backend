CREATE INDEX IF NOT EXISTS "Appointment_clinicId_doctorId_status_startsAt_idx"
  ON "Appointment"("clinicId", "doctorId", "status", "startsAt");

DELETE FROM "PrescriptionTemplate" a
USING "PrescriptionTemplate" b
WHERE a."clinicId" = b."clinicId"
  AND a."doctorId" = b."doctorId"
  AND a."updatedAt" < b."updatedAt";

CREATE UNIQUE INDEX IF NOT EXISTS "PrescriptionTemplate_clinicId_doctorId_key"
  ON "PrescriptionTemplate"("clinicId", "doctorId");
