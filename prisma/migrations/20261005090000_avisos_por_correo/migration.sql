-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "lastLowStockAlertAt" TIMESTAMP(3),
ADD COLUMN     "lastNoSalesReminderAt" TIMESTAMP(3),
ADD COLUMN     "lastWeeklySummaryAt" TIMESTAMP(3),
ADD COLUMN     "lowStockAlertKey" TEXT,
ALTER COLUMN "weeklySummary" SET DEFAULT true;


-- El resumen semanal recién empieza a funcionar: se activa para todos (se puede apagar en Configuración).
UPDATE "business_settings" SET "weeklySummary" = true;
