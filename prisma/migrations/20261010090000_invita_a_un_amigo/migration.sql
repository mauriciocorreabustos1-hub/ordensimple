-- AlterTable
ALTER TABLE "business" ADD COLUMN     "referralCode" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "invitedByCode" TEXT;

-- CreateTable
CREATE TABLE "referral_program" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "plan" "Plan" NOT NULL DEFAULT 'PRO',
    "invitedDays" INTEGER NOT NULL DEFAULT 14,
    "referrerDays" INTEGER NOT NULL DEFAULT 30,
    "referrerTrigger" TEXT NOT NULL DEFAULT 'VENTAS',
    "minSales" INTEGER NOT NULL DEFAULT 5,
    "maxRewards" INTEGER DEFAULT 12,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral" (
    "id" TEXT NOT NULL,
    "referrerBusinessId" TEXT NOT NULL,
    "referredBusinessId" TEXT NOT NULL,
    "referredUserId" TEXT,
    "invitedDays" INTEGER NOT NULL DEFAULT 0,
    "invitedNote" TEXT,
    "referrerRewardedAt" TIMESTAMP(3),
    "referrerDays" INTEGER,
    "referrerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_referredBusinessId_key" ON "referral"("referredBusinessId");

-- CreateIndex
CREATE INDEX "referral_referrerBusinessId_idx" ON "referral"("referrerBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "business_referralCode_key" ON "business"("referralCode");

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrerBusinessId_fkey" FOREIGN KEY ("referrerBusinessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_referredBusinessId_fkey" FOREIGN KEY ("referredBusinessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

