-- AlterTable
ALTER TABLE "product" ADD COLUMN     "isService" BOOLEAN NOT NULL DEFAULT false;


-- Lo que ya era un servicio pasa a serlo: lo que tiene duración, y lo que no lleva stock en negocios de servicios.
UPDATE "product" SET "isService" = true WHERE "durationMin" IS NOT NULL;
UPDATE "product" p SET "isService" = true, "durationMin" = COALESCE(p."durationMin", 30)
FROM "business" b
WHERE p."businessId" = b."id" AND p."trackStock" = false
  AND (b."type" ILIKE '%Belleza y estética%' OR b."type" ILIKE '%Servicios profesionales%' OR b."type" ILIKE '%Taller o reparaciones%');
-- Los servicios no llevan stock.
UPDATE "product" SET "trackStock" = false WHERE "isService" = true;
