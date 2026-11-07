-- CreateEnum
CREATE TYPE "ActivationCodeStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'USED', 'VOID');

-- AlterTable
ALTER TABLE "business" ADD COLUMN     "licenseCodeId" TEXT;

-- CreateTable
CREATE TABLE "activation_code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'pro_permanente',
    "plan" "Plan" NOT NULL DEFAULT 'PRO',
    "status" "ActivationCodeStatus" NOT NULL DEFAULT 'AVAILABLE',
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,
    "redeemedByEmail" TEXT,
    "businessId" TEXT,
    "mlOrderId" TEXT,
    "mlUnit" INTEGER,
    "sendAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sendingUntil" TIMESTAMP(3),

    CONSTRAINT "activation_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_order" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "buyerId" TEXT,
    "buyerNick" TEXT,
    "status" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "units" INTEGER NOT NULL DEFAULT 0,
    "pendingUnits" INTEGER NOT NULL DEFAULT 0,
    "reviewReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ml_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mercado_libre_account" (
    "id" TEXT NOT NULL DEFAULT 'principal',
    "sellerId" TEXT NOT NULL,
    "nickname" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "connectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercado_libre_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_log" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "codeId" TEXT,
    "code" TEXT,
    "mlOrderId" TEXT,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activation_code_code_key" ON "activation_code"("code");

-- CreateIndex
CREATE INDEX "activation_code_status_createdAt_idx" ON "activation_code"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "activation_code_mlOrderId_mlUnit_key" ON "activation_code"("mlOrderId", "mlUnit");

-- CreateIndex
CREATE INDEX "license_log_createdAt_idx" ON "license_log"("createdAt");

