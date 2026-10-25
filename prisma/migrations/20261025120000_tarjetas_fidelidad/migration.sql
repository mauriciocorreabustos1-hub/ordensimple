-- CreateEnum
CREATE TYPE "LoyaltyMode" AS ENUM ('STAMPS', 'POINTS');

-- CreateEnum
CREATE TYPE "LoyaltyMovementKind" AS ENUM ('EARN', 'REDEEM', 'ADJUST');

-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loyaltyGoal" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "loyaltyMinPurchase" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyMode" "LoyaltyMode" NOT NULL DEFAULT 'STAMPS',
ADD COLUMN     "loyaltyPointValue" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "loyaltyReward" TEXT;

-- CreateTable
CREATE TABLE "loyalty_card" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "rewards" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_movement" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "kind" "LoyaltyMovementKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "saleId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_movement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_card_customerId_key" ON "loyalty_card"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_card_token_key" ON "loyalty_card"("token");

-- CreateIndex
CREATE INDEX "loyalty_card_businessId_updatedAt_idx" ON "loyalty_card"("businessId", "updatedAt");

-- CreateIndex
CREATE INDEX "loyalty_movement_cardId_createdAt_idx" ON "loyalty_movement"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_movement_saleId_idx" ON "loyalty_movement"("saleId");

-- AddForeignKey
ALTER TABLE "loyalty_card" ADD CONSTRAINT "loyalty_card_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_card" ADD CONSTRAINT "loyalty_card_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_movement" ADD CONSTRAINT "loyalty_movement_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "loyalty_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

