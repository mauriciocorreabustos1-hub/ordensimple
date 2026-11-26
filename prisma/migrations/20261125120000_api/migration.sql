-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "lastError" TEXT,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_key_hash_key" ON "api_key"("hash");

-- CreateIndex
CREATE INDEX "api_key_businessId_idx" ON "api_key"("businessId");

-- CreateIndex
CREATE INDEX "webhook_businessId_idx" ON "webhook"("businessId");

-- CreateIndex
CREATE INDEX "customer_businessId_updatedAt_idx" ON "customer"("businessId", "updatedAt");

-- CreateIndex
CREATE INDEX "product_businessId_updatedAt_idx" ON "product"("businessId", "updatedAt");

-- CreateIndex
CREATE INDEX "quote_businessId_updatedAt_idx" ON "quote"("businessId", "updatedAt");

-- CreateIndex
CREATE INDEX "sale_businessId_updatedAt_idx" ON "sale"("businessId", "updatedAt");

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook" ADD CONSTRAINT "webhook_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

