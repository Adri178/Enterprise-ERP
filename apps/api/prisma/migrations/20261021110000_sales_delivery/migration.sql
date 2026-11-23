BEGIN;
-- CreateEnum
CREATE TYPE "SalesKind" AS ENUM ('QUOTATION', 'SALES_ORDER', 'DELIVERY_NOTE', 'SALES_INVOICE', 'PAYMENT');

-- CreateEnum
CREATE TYPE "SalesStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "StockLedger" ADD COLUMN     "salesDocumentId" TEXT;

-- CreateTable
CREATE TABLE "SalesDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "kind" "SalesKind" NOT NULL,
    "status" "SalesStatus" NOT NULL DEFAULT 'DRAFT',
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "sourceId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesLine" (
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
    "stockCost" DECIMAL(20,2),

    CONSTRAINT "SalesLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesDocument_companyId_sourceId_kind_idx" ON "SalesDocument"("companyId", "sourceId", "kind");

-- CreateIndex
CREATE INDEX "SalesDocument_companyId_kind_status_date_idx" ON "SalesDocument"("companyId", "kind", "status", "date");

-- CreateIndex
CREATE INDEX "SalesDocument_companyId_customerId_status_idx" ON "SalesDocument"("companyId", "customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesDocument_companyId_id_key" ON "SalesDocument"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SalesDocument_companyId_number_key" ON "SalesDocument"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SalesDocument_companyId_requestKey_key" ON "SalesDocument"("companyId", "requestKey");

-- CreateIndex
CREATE INDEX "SalesLine_companyId_itemId_idx" ON "SalesLine"("companyId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesLine_companyId_documentId_itemId_key" ON "SalesLine"("companyId", "documentId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_id_key" ON "Customer"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StockLedger_companyId_salesDocumentId_itemId_key" ON "StockLedger"("companyId", "salesDocumentId", "itemId");

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_companyId_salesDocumentId_fkey" FOREIGN KEY ("companyId", "salesDocumentId") REFERENCES "SalesDocument"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_companyId_customerId_fkey" FOREIGN KEY ("companyId", "customerId") REFERENCES "Customer"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_companyId_warehouseId_fkey" FOREIGN KEY ("companyId", "warehouseId") REFERENCES "Warehouse"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_companyId_sourceId_fkey" FOREIGN KEY ("companyId", "sourceId") REFERENCES "SalesDocument"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLine" ADD CONSTRAINT "SalesLine_companyId_documentId_fkey" FOREIGN KEY ("companyId", "documentId") REFERENCES "SalesDocument"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLine" ADD CONSTRAINT "SalesLine_companyId_itemId_fkey" FOREIGN KEY ("companyId", "itemId") REFERENCES "Item"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SalesDocument_active_successor_key" ON "SalesDocument" ("companyId", "sourceId", "kind") WHERE "sourceId" IS NOT NULL AND "status" <> 'CANCELLED';
ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_amount_valid" CHECK ("amount" > 0 AND "amount" <= 1000000000000);
ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_source_required" CHECK (("kind" = 'QUOTATION') = ("sourceId" IS NULL));
ALTER TABLE "SalesLine" ADD CONSTRAINT "SalesLine_values_valid" CHECK ("quantity" > 0 AND "unitPrice" > 0 AND "amount" = "quantity" * "unitPrice" AND ("stockCost" IS NULL OR "stockCost" >= 0));
ALTER TABLE "StockLedger" DROP CONSTRAINT "StockLedger_source_valid";
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_source_valid" CHECK (("documentId" IS NOT NULL)::int + ("operationId" IS NOT NULL)::int + ("salesDocumentId" IS NOT NULL)::int = 1);
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_sales_values_valid" CHECK ("salesDocumentId" IS NULL OR ("quantity" < 0 AND "value" <= 0));
COMMIT;
