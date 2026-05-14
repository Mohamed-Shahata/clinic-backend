ALTER TABLE "PatientAttachment"
ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;

ALTER TABLE "Prescription"
ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PatientAttachment_appointmentId_fkey'
  ) THEN
    ALTER TABLE "PatientAttachment"
    ADD CONSTRAINT "PatientAttachment_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Prescription_appointmentId_fkey'
  ) THEN
    ALTER TABLE "Prescription"
    ADD CONSTRAINT "Prescription_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PatientAttachment_appointmentId_idx" ON "PatientAttachment"("appointmentId");
CREATE INDEX IF NOT EXISTS "Prescription_appointmentId_idx" ON "Prescription"("appointmentId");
