-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'ARRIVED', 'DONE', 'NO_SHOW', 'CANCELLED');

-- AlterTable
ALTER TABLE "product" ADD COLUMN     "durationMin" INTEGER;

-- CreateTable
CREATE TABLE "appointment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "productId" TEXT,
    "serviceName" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "staffId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "saleId" TEXT,
    "createdById" TEXT,
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_saleId_key" ON "appointment"("saleId");

-- CreateIndex
CREATE INDEX "appointment_businessId_startAt_idx" ON "appointment"("businessId", "startAt");

-- CreateIndex
CREATE INDEX "appointment_staffId_startAt_idx" ON "appointment"("staffId", "startAt");

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

