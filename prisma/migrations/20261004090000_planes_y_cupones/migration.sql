-- CreateEnum
CREATE TYPE "CouponKind" AS ENUM ('FREE_DAYS', 'PERCENT');

-- AlterTable
ALTER TABLE "business" ADD COLUMN     "discountCode" TEXT,
ADD COLUMN     "discountPercent" INTEGER,
ADD COLUMN     "planExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "CouponKind" NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'PRO',
    "days" INTEGER,
    "percentOff" INTEGER,
    "maxRedemptions" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupon_code_key" ON "coupon"("code");

-- CreateIndex
CREATE INDEX "coupon_redemption_businessId_idx" ON "coupon_redemption"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemption_couponId_businessId_key" ON "coupon_redemption"("couponId", "businessId");

-- AddForeignKey
ALTER TABLE "coupon_redemption" ADD CONSTRAINT "coupon_redemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemption" ADD CONSTRAINT "coupon_redemption_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

