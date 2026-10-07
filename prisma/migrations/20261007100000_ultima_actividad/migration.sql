-- AlterTable
ALTER TABLE "user" ADD COLUMN     "lastActiveAt" TIMESTAMP(3);


-- Punto de partida: la última sesión de cada persona.
UPDATE "user" u SET "lastActiveAt" = s.last
FROM (SELECT "userId", MAX("updatedAt") AS last FROM "session" GROUP BY "userId") s
WHERE s."userId" = u."id";
