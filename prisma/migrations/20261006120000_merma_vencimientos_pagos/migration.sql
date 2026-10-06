-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'WASTE';

-- AlterTable
ALTER TABLE "inventory_movement" ADD COLUMN     "unitCost" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "product" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "payable" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "supplierId" TEXT,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "expenseId" TEXT,
    "remindedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payable_businessId_paidAt_dueDate_idx" ON "payable"("businessId", "paidAt", "dueDate");

-- AddForeignKey
ALTER TABLE "payable" ADD CONSTRAINT "payable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable" ADD CONSTRAINT "payable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

