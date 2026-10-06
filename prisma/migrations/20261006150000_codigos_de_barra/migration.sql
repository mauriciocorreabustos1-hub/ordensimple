-- CreateTable
CREATE TABLE "product_barcode" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_barcode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_barcode_productId_idx" ON "product_barcode"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_barcode_businessId_code_key" ON "product_barcode"("businessId", "code");

-- AddForeignKey
ALTER TABLE "product_barcode" ADD CONSTRAINT "product_barcode_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcode" ADD CONSTRAINT "product_barcode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

