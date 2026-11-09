-- CreateTable
CREATE TABLE "contact_card" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "company" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "linkedin" TEXT,
    "tiktok" TEXT,
    "x" TEXT,
    "published" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photo" BYTEA,
    "photoType" TEXT,
    "photoUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_card_userId_key" ON "contact_card"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_card_slug_key" ON "contact_card"("slug");

-- CreateIndex
CREATE INDEX "contact_card_businessId_idx" ON "contact_card"("businessId");

-- AddForeignKey
ALTER TABLE "contact_card" ADD CONSTRAINT "contact_card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_card" ADD CONSTRAINT "contact_card_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

