-- CreateEnum
CREATE TYPE "WebOrderStatus" AS ENUM ('NEW', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "business" ADD COLUMN     "storeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storeMessage" TEXT,
ADD COLUMN     "storeSlug" TEXT,
ADD COLUMN     "storeWhatsapp" TEXT;

-- CreateTable
CREATE TABLE "web_order" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "delivery" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "items" JSONB NOT NULL,
    "total" INTEGER NOT NULL,
    "status" "WebOrderStatus" NOT NULL DEFAULT 'NEW',
    "saleId" TEXT,
    "comandaId" TEXT,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "web_order_businessId_status_createdAt_idx" ON "web_order"("businessId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "business_storeSlug_key" ON "business"("storeSlug");

-- AddForeignKey
ALTER TABLE "web_order" ADD CONSTRAINT "web_order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

