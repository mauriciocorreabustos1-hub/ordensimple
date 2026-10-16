-- AlterTable
ALTER TABLE "comanda_item" ADD COLUMN     "sentAt" TIMESTAMP(3);


-- Lo ya enviado toma como hora de envío su última modificación.
UPDATE "comanda_item" SET "sentAt" = "updatedAt" WHERE "sentQty" > 0;
