-- CreateIndex
CREATE INDEX "expense_supplierId_idx" ON "expense"("supplierId");

-- CreateIndex
CREATE INDEX "expense_categoryId_idx" ON "expense"("categoryId");

-- CreateIndex
CREATE INDEX "inventory_movement_saleId_idx" ON "inventory_movement"("saleId");

-- CreateIndex
CREATE INDEX "inventory_movement_productId_idx" ON "inventory_movement"("productId");

-- CreateIndex
CREATE INDEX "payable_supplierId_idx" ON "payable"("supplierId");

-- CreateIndex
CREATE INDEX "product_categoryId_idx" ON "product"("categoryId");

-- CreateIndex
CREATE INDEX "sale_customerId_idx" ON "sale"("customerId");

