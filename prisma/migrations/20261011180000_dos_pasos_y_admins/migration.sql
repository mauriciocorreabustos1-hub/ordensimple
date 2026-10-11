-- AlterTable
ALTER TABLE "user" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorMethod" TEXT;

-- CreateTable
CREATE TABLE "two_factor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT true,
    "failedVerificationCount" INTEGER DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "two_factor_secret_idx" ON "two_factor"("secret");

-- CreateIndex
CREATE INDEX "two_factor_userId_idx" ON "two_factor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_email_key" ON "admin_user"("email");

-- AddForeignKey
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

