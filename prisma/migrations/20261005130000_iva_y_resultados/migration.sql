-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "chargesVat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vatDueDay" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "expense" ADD COLUMN     "hasInvoice" BOOLEAN NOT NULL DEFAULT false;

