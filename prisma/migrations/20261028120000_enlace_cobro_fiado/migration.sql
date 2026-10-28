-- AlterTable
ALTER TABLE "payment_link" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "forDebt" BOOLEAN NOT NULL DEFAULT false;
