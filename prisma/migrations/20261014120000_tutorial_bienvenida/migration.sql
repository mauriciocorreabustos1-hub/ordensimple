-- AlterTable
ALTER TABLE "user" ADD COLUMN     "welcomeTourAt" TIMESTAMP(3);


-- Quienes ya usan la app no necesitan el tutorial: solo lo verán las cuentas nuevas.
UPDATE "user" SET "welcomeTourAt" = NOW();
