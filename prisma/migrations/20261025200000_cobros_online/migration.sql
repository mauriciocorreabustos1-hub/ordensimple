-- CreateEnum
CREATE TYPE "OnlinePaymentKind" AS ENUM ('WEB_ORDER', 'QUOTE', 'LINK');

-- CreateEnum
CREATE TYPE "OnlinePaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentLinkStatus" AS ENUM ('ACTIVE', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "mercado_pago_account" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "mpUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "publicKey" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "liveMode" BOOLEAN NOT NULL DEFAULT true,
    "storeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercado_pago_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_payment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "OnlinePaymentKind" NOT NULL,
    "webOrderId" TEXT,
    "quoteId" TEXT,
    "linkId" TEXT,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "status" "OnlinePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "preferenceId" TEXT,
    "mpPaymentId" TEXT,
    "method" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_link" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "saleId" TEXT,
    "createdById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mercado_pago_account_businessId_key" ON "mercado_pago_account"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "online_payment_mpPaymentId_key" ON "online_payment"("mpPaymentId");

-- CreateIndex
CREATE INDEX "online_payment_businessId_createdAt_idx" ON "online_payment"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "online_payment_webOrderId_idx" ON "online_payment"("webOrderId");

-- CreateIndex
CREATE INDEX "online_payment_quoteId_idx" ON "online_payment"("quoteId");

-- CreateIndex
CREATE INDEX "online_payment_linkId_idx" ON "online_payment"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_link_token_key" ON "payment_link"("token");

-- CreateIndex
CREATE INDEX "payment_link_businessId_createdAt_idx" ON "payment_link"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "mercado_pago_account" ADD CONSTRAINT "mercado_pago_account_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_payment" ADD CONSTRAINT "online_payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_link" ADD CONSTRAINT "payment_link_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

