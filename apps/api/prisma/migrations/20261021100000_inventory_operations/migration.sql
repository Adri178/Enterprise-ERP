BEGIN;
-- CreateEnum
CREATE TYPE "StockOperationKind" AS ENUM ('TRANSFER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockOperationStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "StockLedger" ADD COLUMN     "operationId" TEXT,
ALTER COLUMN "documentId" DROP NOT NULL,
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(20,6);

-- CreateTable
CREATE TABLE "StockOperation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "kind" "StockOperationKind" NOT NULL,
    "status" "StockOperationStatus" NOT NULL DEFAULT 'DRAFT',
    "date" DATE NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "targetWarehouseId" TEXT,
    "targetWarehouseName" TEXT,
    "description" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockOperationLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(20,6) NOT NULL,
    "value" DECIMAL(20,2),

    CONSTRAINT "StockOperationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockOperation_companyId_kind_status_date_idx" ON "StockOperation"("companyId", "kind", "status", "date");

-- CreateIndex
CREATE INDEX "StockOperation_companyId_warehouseId_idx" ON "StockOperation"("companyId", "warehouseId");

-- CreateIndex
CREATE INDEX "StockOperation_companyId_targetWarehouseId_idx" ON "StockOperation"("companyId", "targetWarehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOperation_companyId_id_key" ON "StockOperation"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StockOperation_companyId_number_key" ON "StockOperation"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "StockOperation_companyId_requestKey_key" ON "StockOperation"("companyId", "requestKey");

-- CreateIndex
CREATE INDEX "StockOperationLine_companyId_itemId_idx" ON "StockOperationLine"("companyId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOperationLine_companyId_operationId_itemId_key" ON "StockOperationLine"("companyId", "operationId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLedger_companyId_operationId_itemId_warehouseId_key" ON "StockLedger"("companyId", "operationId", "itemId", "warehouseId");

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_companyId_operationId_fkey" FOREIGN KEY ("companyId", "operationId") REFERENCES "StockOperation"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_companyId_warehouseId_fkey" FOREIGN KEY ("companyId", "warehouseId") REFERENCES "Warehouse"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_companyId_targetWarehouseId_fkey" FOREIGN KEY ("companyId", "targetWarehouseId") REFERENCES "Warehouse"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOperationLine" ADD CONSTRAINT "StockOperationLine_companyId_operationId_fkey" FOREIGN KEY ("companyId", "operationId") REFERENCES "StockOperation"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOperationLine" ADD CONSTRAINT "StockOperationLine_companyId_itemId_fkey" FOREIGN KEY ("companyId", "itemId") REFERENCES "Item"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockLedger" DROP CONSTRAINT "StockLedger_receipt_values_valid";
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_source_valid" CHECK (("documentId" IS NOT NULL)::int + ("operationId" IS NOT NULL)::int = 1);
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_values_valid" CHECK ("quantity" <> 0 AND "unitPrice" >= 0 AND (("quantity" > 0 AND "value" >= 0) OR ("quantity" < 0 AND "value" <= 0)));
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_receipt_values_valid" CHECK ("documentId" IS NULL OR ("quantity" > 0 AND "unitPrice" > 0 AND "value" = "quantity" * "unitPrice"));
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_empty_value" CHECK ("quantity" <> 0 OR "value" = 0);
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_warehouse_valid" CHECK (("kind" = 'TRANSFER' AND "targetWarehouseId" IS NOT NULL AND "targetWarehouseId" <> "warehouseId") OR ("kind" = 'ADJUSTMENT' AND "targetWarehouseId" IS NULL));
ALTER TABLE "StockOperationLine" ADD CONSTRAINT "StockOperationLine_values_valid" CHECK ("quantity" <> 0 AND "unitPrice" >= 0 AND ("value" IS NULL OR ("quantity" > 0 AND "value" >= 0) OR ("quantity" < 0 AND "value" <= 0)));
COMMIT;
