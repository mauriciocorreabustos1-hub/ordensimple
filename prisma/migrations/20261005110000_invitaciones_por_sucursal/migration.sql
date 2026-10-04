-- AlterTable
ALTER TABLE "invitation" ADD COLUMN     "batchId" TEXT;

-- CreateIndex
CREATE INDEX "invitation_batchId_idx" ON "invitation"("batchId");

