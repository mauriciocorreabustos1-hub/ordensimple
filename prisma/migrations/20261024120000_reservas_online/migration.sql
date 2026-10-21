-- AlterTable
ALTER TABLE "appointment" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'APP';

-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "bookingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bookingHours" JSONB,
ADD COLUMN     "bookingMaxDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "bookingMinNoticeMin" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "bookingSlotMin" INTEGER NOT NULL DEFAULT 30;

