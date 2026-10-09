-- AlterTable
ALTER TABLE "sale" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sale_businessId_clientId_key" ON "sale"("businessId", "clientId");

