-- CreateEnum
CREATE TYPE "PromotionKind" AS ENUM ('PERCENT', 'BUY_X_PAY_Y');

-- AlterTable
ALTER TABLE "sale" ADD COLUMN     "promoDiscount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "web_order" ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "couponDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promoDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promos" JSONB;

-- CreateTable
CREATE TABLE "promotion" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PromotionKind" NOT NULL,
    "percent" INTEGER,
    "buyQty" INTEGER,
    "payQty" INTEGER,
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "fromMinute" INTEGER,
    "toMinute" INTEGER,
    "inStore" BOOLEAN NOT NULL DEFAULT true,
    "online" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_promotion" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "promotionId" TEXT,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "sale_promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_coupon" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "percent" INTEGER,
    "amount" INTEGER,
    "minTotal" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_coupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotion_businessId_active_idx" ON "promotion"("businessId", "active");

-- CreateIndex
CREATE INDEX "sale_promotion_saleId_idx" ON "sale_promotion"("saleId");

-- CreateIndex
CREATE INDEX "sale_promotion_promotionId_idx" ON "sale_promotion"("promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "store_coupon_businessId_code_key" ON "store_coupon"("businessId", "code");

-- AddForeignKey
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_promotion" ADD CONSTRAINT "sale_promotion_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_promotion" ADD CONSTRAINT "sale_promotion_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_coupon" ADD CONSTRAINT "store_coupon_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

