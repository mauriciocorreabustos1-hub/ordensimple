-- CreateTable
CREATE TABLE "subscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'PRO',
    "provider" TEXT NOT NULL DEFAULT 'MERCADOPAGO',
    "externalId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "payerEmail" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "lastChargedAt" TIMESTAMP(3),
    "nextPaymentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_externalId_key" ON "subscription"("externalId");

-- CreateIndex
CREATE INDEX "subscription_businessId_idx" ON "subscription"("businessId");

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

