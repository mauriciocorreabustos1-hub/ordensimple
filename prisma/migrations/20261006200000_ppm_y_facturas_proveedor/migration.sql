-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "ppmRate" DOUBLE PRECISION NOT NULL DEFAULT 0.00125;

-- AlterTable
ALTER TABLE "payable" ADD COLUMN     "hasInvoice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "invoiceDate" TIMESTAMP(3);

