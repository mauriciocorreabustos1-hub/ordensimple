-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "fiadoDays" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "fiadoReminderKey" TEXT,
ADD COLUMN     "fiadoReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastFiadoReminderAt" TIMESTAMP(3);

