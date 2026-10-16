-- AlterTable
ALTER TABLE "comanda_item" ADD COLUMN     "sentQty" INTEGER NOT NULL DEFAULT 0;


-- Lo que ya estaba en comandas abiertas se considera enviado (así funcionaba antes).
UPDATE "comanda_item" SET "sentQty" = "quantity";
