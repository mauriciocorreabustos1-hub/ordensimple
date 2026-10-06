-- CreateTable
CREATE TABLE "assistant_usage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_usage_businessId_createdAt_idx" ON "assistant_usage"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "assistant_usage" ADD CONSTRAINT "assistant_usage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

