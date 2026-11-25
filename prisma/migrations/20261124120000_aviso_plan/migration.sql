-- Aviso de que el plan vence: solo agrega una columna (para revertir: ALTER TABLE "business" DROP COLUMN "planNoticeKey";).
-- AlterTable
ALTER TABLE "business" ADD COLUMN     "planNoticeKey" TEXT;

