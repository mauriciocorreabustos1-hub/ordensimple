-- CreateTable
CREATE TABLE "recipe_material_movement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_material_movement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipe_material_movement_saleId_idx" ON "recipe_material_movement"("saleId");

-- CreateIndex
CREATE INDEX "recipe_material_movement_materialId_createdAt_idx" ON "recipe_material_movement"("materialId", "createdAt");

-- AddForeignKey
ALTER TABLE "recipe_material_movement" ADD CONSTRAINT "recipe_material_movement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_material_movement" ADD CONSTRAINT "recipe_material_movement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "recipe_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_material_movement" ADD CONSTRAINT "recipe_material_movement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

