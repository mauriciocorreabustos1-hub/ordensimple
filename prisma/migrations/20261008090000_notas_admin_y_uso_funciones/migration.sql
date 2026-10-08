-- CreateTable
CREATE TABLE "admin_note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_usage" (
    "businessId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "feature_usage_pkey" PRIMARY KEY ("businessId","feature","day")
);

-- CreateIndex
CREATE INDEX "admin_note_userId_createdAt_idx" ON "admin_note"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "feature_usage_feature_day_idx" ON "feature_usage"("feature", "day");

-- AddForeignKey
ALTER TABLE "admin_note" ADD CONSTRAINT "admin_note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_usage" ADD CONSTRAINT "feature_usage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

