-- AlterTable
ALTER TABLE "business" ADD COLUMN     "logoUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "business_logo" (
    "businessId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "type" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_logo_pkey" PRIMARY KEY ("businessId")
);

-- AddForeignKey
ALTER TABLE "business_logo" ADD CONSTRAINT "business_logo_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

