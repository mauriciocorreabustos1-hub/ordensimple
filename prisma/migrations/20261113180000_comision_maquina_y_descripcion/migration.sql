-- Comisión de la máquina de tarjetas (POS) por débito y crédito, en %.
ALTER TABLE "business_settings" ADD COLUMN     "cardFeeCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "cardFeeDebit" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Descripción de los productos para la tienda online.
ALTER TABLE "product" ADD COLUMN     "description" TEXT;
