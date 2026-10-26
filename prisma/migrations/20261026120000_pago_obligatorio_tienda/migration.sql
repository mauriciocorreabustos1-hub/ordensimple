-- CreateEnum
CREATE TYPE "StorePayRule" AS ENUM ('ALL', 'DELIVERY');

-- AlterTable
ALTER TABLE "mercado_pago_account" ADD COLUMN     "storePayRule" "StorePayRule" NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "web_order" ADD COLUMN     "paymentRequired" BOOLEAN NOT NULL DEFAULT false;


-- Al conectar Mercado Pago, la tienda sigue cobrando al retirar o recibir hasta que el dueño elija.
ALTER TABLE "mercado_pago_account" ALTER COLUMN "storeEnabled" SET DEFAULT false;

-- Las cuentas ya conectadas quedan cobrando al retirar o recibir hasta que el dueño elija (nada cambia solo).
UPDATE "mercado_pago_account" SET "storeEnabled" = false;
