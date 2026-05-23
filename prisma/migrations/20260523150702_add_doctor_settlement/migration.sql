-- CreateTable
CREATE TABLE "DoctorSettlement" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorUserId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalRevenue" DECIMAL(12,2) NOT NULL,
    "clinicShare" DECIMAL(12,2) NOT NULL,
    "doctorNet" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoctorSettlement_clinicId_month_idx" ON "DoctorSettlement"("clinicId", "month");

-- CreateIndex
CREATE INDEX "DoctorSettlement_clinicId_doctorUserId_idx" ON "DoctorSettlement"("clinicId", "doctorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSettlement_clinicId_doctorUserId_month_key" ON "DoctorSettlement"("clinicId", "doctorUserId", "month");

-- AddForeignKey
ALTER TABLE "DoctorSettlement" ADD CONSTRAINT "DoctorSettlement_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
