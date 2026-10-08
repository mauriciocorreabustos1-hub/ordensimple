-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "openingCash" INTEGER,
ADD COLUMN     "openingCashAt" TIMESTAMP(3),
ADD COLUMN     "ownerSalary" INTEGER;

-- CreateTable
CREATE TABLE "owner_withdrawal" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CASH',
    "kind" TEXT NOT NULL DEFAULT 'MONEY',
    "productId" TEXT,
    "quantity" INTEGER,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,
    "installment" INTEGER,
    "dueDay" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_snapshot" (
    "businessId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "assets" INTEGER NOT NULL,
    "liabilities" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balance_snapshot_pkey" PRIMARY KEY ("businessId","month")
);

-- CreateIndex
CREATE INDEX "owner_withdrawal_businessId_date_idx" ON "owner_withdrawal"("businessId", "date");

-- CreateIndex
CREATE INDEX "loan_businessId_idx" ON "loan"("businessId");

-- AddForeignKey
ALTER TABLE "owner_withdrawal" ADD CONSTRAINT "owner_withdrawal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan" ADD CONSTRAINT "loan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshot" ADD CONSTRAINT "balance_snapshot_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

