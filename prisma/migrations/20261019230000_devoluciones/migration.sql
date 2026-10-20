-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "sale" ADD COLUMN     "returnOfId" TEXT;

-- CreateTable
CREATE TABLE "sale_return" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "returnSaleId" TEXT,
    "items" JSONB NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refundMethod" "PaymentMethod" NOT NULL,
    "restock" BOOLEAN NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_return_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sale_return_returnSaleId_key" ON "sale_return"("returnSaleId");

-- CreateIndex
CREATE INDEX "sale_return_businessId_status_idx" ON "sale_return"("businessId", "status");

-- CreateIndex
CREATE INDEX "sale_return_saleId_idx" ON "sale_return"("saleId");

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_returnOfId_fkey" FOREIGN KEY ("returnOfId") REFERENCES "sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return" ADD CONSTRAINT "sale_return_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return" ADD CONSTRAINT "sale_return_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return" ADD CONSTRAINT "sale_return_returnSaleId_fkey" FOREIGN KEY ("returnSaleId") REFERENCES "sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

