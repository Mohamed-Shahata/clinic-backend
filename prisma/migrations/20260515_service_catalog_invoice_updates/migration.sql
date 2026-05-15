-- Add paidAmount and notes to Invoice
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable: ServiceCatalog
CREATE TABLE IF NOT EXISTS "ServiceCatalog" (
    "id"        TEXT NOT NULL,
    "clinicId"  TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "price"     DECIMAL(12,2) NOT NULL,
    "category"  TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceCatalog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ServiceCatalog" ADD CONSTRAINT "ServiceCatalog_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "ServiceCatalog_clinicId_isActive_idx" ON "ServiceCatalog"("clinicId","isActive");
CREATE INDEX IF NOT EXISTS "ServiceCatalog_clinicId_name_idx" ON "ServiceCatalog"("clinicId","name");
