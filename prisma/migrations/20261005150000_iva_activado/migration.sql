-- El IVA viene activado: quien no lo cobra lo desactiva en Configuración.
ALTER TABLE "business_settings" ALTER COLUMN "chargesVat" SET DEFAULT true;

UPDATE "business_settings" SET "chargesVat" = true;
