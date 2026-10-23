-- CreateTable
CREATE TABLE "recipe_material" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "packQty" DOUBLE PRECISION NOT NULL,
    "packPrice" INTEGER NOT NULL,
    "stock" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "yieldUnits" INTEGER NOT NULL DEFAULT 1,
    "overheadPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_item" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "recipe_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipe_material_businessId_name_key" ON "recipe_material"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_businessId_name_key" ON "recipe"("businessId", "name");

-- CreateIndex
CREATE INDEX "recipe_item_recipeId_idx" ON "recipe_item"("recipeId");

-- CreateIndex
CREATE INDEX "recipe_item_materialId_idx" ON "recipe_item"("materialId");

-- AddForeignKey
ALTER TABLE "recipe_material" ADD CONSTRAINT "recipe_material_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_item" ADD CONSTRAINT "recipe_item_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_item" ADD CONSTRAINT "recipe_item_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "recipe_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

