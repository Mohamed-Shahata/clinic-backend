-- CreateIndex
CREATE INDEX "Appointment_clinicId_status_startsAt_idx" ON "Appointment"("clinicId", "status", "startsAt");
