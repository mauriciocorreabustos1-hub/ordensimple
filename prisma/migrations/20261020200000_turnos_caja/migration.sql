-- CreateTable
CREATE TABLE "cash_shift" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "openedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opening" INTEGER NOT NULL,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "salesTotal" INTEGER NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "cashSales" INTEGER NOT NULL DEFAULT 0,
    "cashIn" INTEGER NOT NULL DEFAULT 0,
    "cashOut" INTEGER NOT NULL DEFAULT 0,
    "expected" INTEGER NOT NULL DEFAULT 0,
    "counted" INTEGER,
    "difference" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_shift_businessId_openedAt_idx" ON "cash_shift"("businessId", "openedAt");

-- AddForeignKey
ALTER TABLE "cash_shift" ADD CONSTRAINT "cash_shift_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_shift" ADD CONSTRAINT "cash_shift_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_shift" ADD CONSTRAINT "cash_shift_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

