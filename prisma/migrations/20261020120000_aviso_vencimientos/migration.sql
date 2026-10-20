-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "expiryAlertKey" TEXT,
ADD COLUMN     "expiryAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastExpiryAlertAt" TIMESTAMP(3);

