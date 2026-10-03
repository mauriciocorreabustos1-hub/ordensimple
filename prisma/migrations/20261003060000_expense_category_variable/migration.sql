-- AlterTable
ALTER TABLE "expense_category" ADD COLUMN "isVariable" BOOLEAN NOT NULL DEFAULT false;

-- Las compras a proveedores crecen con las ventas: se tratan como gasto variable.
UPDATE "expense_category" SET "isVariable" = true WHERE "isDefault" = true AND "name" = 'Proveedores';
