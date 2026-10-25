-- CreateEnum
CREATE TYPE "WebOrderStage" AS ENUM ('RECEIVED', 'PREPARING', 'READY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SOLD');

-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "quoteTerms" TEXT,
ADD COLUMN     "quoteValidDays" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "taxId" TEXT;

-- AlterTable
ALTER TABLE "web_order" ADD COLUMN     "stage" "WebOrderStage" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN     "stageTimes" JSONB,
ADD COLUMN     "trackToken" TEXT;

-- Los pedidos que ya existían también tienen su enlace de seguimiento (aleatorio, imposible de adivinar).
UPDATE "web_order" SET "trackToken" = replace(gen_random_uuid()::text, '-', '') WHERE "trackToken" IS NULL;
ALTER TABLE "web_order" ALTER COLUMN "trackToken" SET NOT NULL;

-- CreateTable
CREATE TABLE "quote" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "items" JSONB NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "note" TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "saleId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quote_token_key" ON "quote"("token");

-- CreateIndex
CREATE INDEX "quote_businessId_status_createdAt_idx" ON "quote"("businessId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "quote_businessId_number_key" ON "quote"("businessId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "web_order_trackToken_key" ON "web_order"("trackToken");

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Los pedidos que ya se habían atendido antes del seguimiento quedan como entregados.
UPDATE "web_order" SET "stage" = 'DELIVERED' WHERE "status" = 'DONE';
