-- CreateTable
CREATE TABLE "special_link" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'PRO',
    "days" INTEGER NOT NULL DEFAULT 14,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "special_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_link_use" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "days" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "special_link_use_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "special_link_code_key" ON "special_link"("code");

-- CreateIndex
CREATE INDEX "special_link_use_businessId_idx" ON "special_link_use"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "special_link_use_linkId_businessId_key" ON "special_link_use"("linkId", "businessId");

-- AddForeignKey
ALTER TABLE "special_link_use" ADD CONSTRAINT "special_link_use_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "special_link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_link_use" ADD CONSTRAINT "special_link_use_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

