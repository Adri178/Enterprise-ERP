BEGIN;
-- CreateEnum
CREATE TYPE "PurchaseKind" AS ENUM ('PURCHASE_REQUEST', 'PURCHASE_ORDER', 'PURCHASE_RECEIPT', 'PURCHASE_INVOICE', 'PAYMENT');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "companyId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("companyId","prefix","year")
);

-- CreateTable
CREATE TABLE "PurchaseDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "kind" "PurchaseKind" NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "sourceId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(20,2) NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "value" DECIMAL(20,2) NOT NULL DEFAULT 0,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLedger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(20,2) NOT NULL,
    "value" DECIMAL(20,2) NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseDocument_companyId_sourceId_kind_idx" ON "PurchaseDocument"("companyId", "sourceId", "kind");

-- CreateIndex
CREATE INDEX "PurchaseDocument_companyId_kind_status_date_idx" ON "PurchaseDocument"("companyId", "kind", "status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseDocument_companyId_id_key" ON "PurchaseDocument"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseDocument_companyId_number_key" ON "PurchaseDocument"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseDocument_companyId_requestKey_key" ON "PurchaseDocument"("companyId", "requestKey");

-- CreateIndex
CREATE INDEX "PurchaseLine_companyId_itemId_idx" ON "PurchaseLine"("companyId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLine_companyId_documentId_itemId_key" ON "PurchaseLine"("companyId", "documentId", "itemId");

-- CreateIndex
CREATE INDEX "StockBalance_companyId_warehouseId_idx" ON "StockBalance"("companyId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_companyId_itemId_warehouseId_key" ON "StockBalance"("companyId", "itemId", "warehouseId");

-- CreateIndex
CREATE INDEX "StockLedger_companyId_itemId_warehouseId_date_idx" ON "StockLedger"("companyId", "itemId", "warehouseId", "date");

-- CreateIndex
CREATE INDEX "StockLedger_companyId_createdAt_idx" ON "StockLedger"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockLedger_companyId_documentId_itemId_key" ON "StockLedger"("companyId", "documentId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_companyId_id_key" ON "Item"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_companyId_id_key" ON "Supplier"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_companyId_id_key" ON "Warehouse"("companyId", "id");

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_companyId_supplierId_fkey" FOREIGN KEY ("companyId", "supplierId") REFERENCES "Supplier"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_companyId_warehouseId_fkey" FOREIGN KEY ("companyId", "warehouseId") REFERENCES "Warehouse"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_companyId_sourceId_fkey" FOREIGN KEY ("companyId", "sourceId") REFERENCES "PurchaseDocument"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_companyId_documentId_fkey" FOREIGN KEY ("companyId", "documentId") REFERENCES "PurchaseDocument"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_companyId_itemId_fkey" FOREIGN KEY ("companyId", "itemId") REFERENCES "Item"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_companyId_itemId_fkey" FOREIGN KEY ("companyId", "itemId") REFERENCES "Item"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_companyId_warehouseId_fkey" FOREIGN KEY ("companyId", "warehouseId") REFERENCES "Warehouse"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_companyId_documentId_fkey" FOREIGN KEY ("companyId", "documentId") REFERENCES "PurchaseDocument"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_companyId_itemId_fkey" FOREIGN KEY ("companyId", "itemId") REFERENCES "Item"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_companyId_warehouseId_fkey" FOREIGN KEY ("companyId", "warehouseId") REFERENCES "Warehouse"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Full-document conversion: a cancelled draft can be replaced, but never posted twice.
CREATE UNIQUE INDEX "PurchaseDocument_active_successor_key" ON "PurchaseDocument" ("companyId", "sourceId", "kind") WHERE "sourceId" IS NOT NULL AND "status" <> 'CANCELLED';
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_source_required" CHECK (("kind" = 'PURCHASE_REQUEST') = ("sourceId" IS NULL));
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_values_valid" CHECK ("quantity" > 0 AND "unitPrice" > 0 AND "amount" = "quantity" * "unitPrice");
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_receipt_values_valid" CHECK ("quantity" > 0 AND "unitPrice" > 0 AND "value" = "quantity" * "unitPrice");
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_nonnegative" CHECK ("quantity" >= 0 AND "value" >= 0);
COMMIT;
