-- Categoría de gasto "Honorarios" para los negocios que no tienen una (boletas de honorarios con retención en el F29).
INSERT INTO "expense_category" ("id", "businessId", "name", "icon", "isDefault", "isVariable", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, b."id", 'Honorarios', 'briefcase', true, false, now(), now()
FROM "business" b
WHERE NOT EXISTS (
  SELECT 1 FROM "expense_category" c WHERE c."businessId" = b."id" AND c."name" ILIKE '%honorario%'
);
