-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "tableCount" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "tableExtras" TEXT[] DEFAULT ARRAY['Para llevar', 'Delivery']::TEXT[];

