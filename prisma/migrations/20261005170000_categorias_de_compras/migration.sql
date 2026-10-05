-- Las categorías que son compras de mercadería se cuentan en el costo de venta, no como gasto (evita contarlas dos veces).
UPDATE "expense_category" SET "isVariable" = true
WHERE "isVariable" = false AND "name" ~* '(mercader|mercanc|proveedor|insumo|materia prima)';
