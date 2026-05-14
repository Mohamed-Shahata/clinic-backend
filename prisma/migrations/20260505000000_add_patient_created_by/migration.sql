-- AlterTable: add createdById to Patient for doctor ownership tracking
ALTER TABLE "Patient" ADD COLUMN "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Patient_clinicId_createdById_idx" ON "Patient"("clinicId", "createdById");
