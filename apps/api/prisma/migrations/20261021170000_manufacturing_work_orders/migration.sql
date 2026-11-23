BEGIN;
-- CreateEnum
CREATE TYPE "BomStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "StockLedger" ADD COLUMN     "workOrderId" TEXT;

-- CreateTable
CREATE TABLE "BillOfMaterials" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BomStatus" NOT NULL DEFAULT 'DRAFT',
    "outputItemId" TEXT NOT NULL,
    "outputCode" TEXT NOT NULL,
    "outputName" TEXT NOT NULL,
    "outputUnit" TEXT NOT NULL,
    "outputQuantity" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillOfMaterials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "bomCode" TEXT NOT NULL,
    "bomName" TEXT NOT NULL,
    "batches" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "outputItemId" TEXT NOT NULL,
    "outputCode" TEXT NOT NULL,
    "outputName" TEXT NOT NULL,
    "outputUnit" TEXT NOT NULL,
    "outputQuantity" INTEGER NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(20,2),
    "createdBy" TEXT NOT NULL,
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cost" DECIMAL(20,2),

    CONSTRAINT "WorkOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillOfMaterials_companyId_status_code_idx" ON "BillOfMaterials"("companyId", "status", "code");

-- CreateIndex
CREATE INDEX "BillOfMaterials_companyId_outputItemId_idx" ON "BillOfMaterials"("companyId", "outputItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterials_companyId_id_key" ON "BillOfMaterials"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterials_companyId_code_key" ON "BillOfMaterials"("companyId", "code");

-- CreateIndex
CREATE INDEX "BomLine_companyId_itemId_idx" ON "BomLine"("companyId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "BomLine_companyId_bomId_itemId_key" ON "BomLine"("companyId", "bomId", "itemId");

-- CreateIndex
CREATE INDEX "WorkOrder_companyId_status_date_idx" ON "WorkOrder"("companyId", "status", "date");

-- CreateIndex
CREATE INDEX "WorkOrder_companyId_bomId_idx" ON "WorkOrder"("companyId", "bomId");

-- CreateIndex
CREATE INDEX "WorkOrder_companyId_outputItemId_idx" ON "WorkOrder"("companyId", "outputItemId");

-- CreateIndex
CREATE INDEX "WorkOrder_companyId_warehouseId_idx" ON "WorkOrder"("companyId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_companyId_id_key" ON "WorkOrder"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_companyId_number_key" ON "WorkOrder"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_companyId_requestKey_key" ON "WorkOrder"("companyId", "requestKey");

-- CreateIndex
CREATE INDEX "WorkOrderLine_companyId_itemId_idx" ON "WorkOrderLine"("companyId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderLine_companyId_workOrderId_itemId_key" ON "WorkOrderLine"("companyId", "workOrderId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLedger_companyId_workOrderId_itemId_key" ON "StockLedger"("companyId", "workOrderId", "itemId");

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_companyId_workOrderId_fkey" FOREIGN KEY ("companyId", "workOrderId") REFERENCES "WorkOrder"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterials" ADD CONSTRAINT "BillOfMaterials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterials" ADD CONSTRAINT "BillOfMaterials_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterials" ADD CONSTRAINT "BillOfMaterials_companyId_outputItemId_fkey" FOREIGN KEY ("companyId", "outputItemId") REFERENCES "Item"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_companyId_bomId_fkey" FOREIGN KEY ("companyId", "bomId") REFERENCES "BillOfMaterials"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_companyId_itemId_fkey" FOREIGN KEY ("companyId", "itemId") REFERENCES "Item"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_companyId_bomId_fkey" FOREIGN KEY ("companyId", "bomId") REFERENCES "BillOfMaterials"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_companyId_outputItemId_fkey" FOREIGN KEY ("companyId", "outputItemId") REFERENCES "Item"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_companyId_warehouseId_fkey" FOREIGN KEY ("companyId", "warehouseId") REFERENCES "Warehouse"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderLine" ADD CONSTRAINT "WorkOrderLine_companyId_workOrderId_fkey" FOREIGN KEY ("companyId", "workOrderId") REFERENCES "WorkOrder"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderLine" ADD CONSTRAINT "WorkOrderLine_companyId_itemId_fkey" FOREIGN KEY ("companyId", "itemId") REFERENCES "Item"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockLedger" DROP CONSTRAINT "StockLedger_source_valid";
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_source_valid" CHECK (("documentId" IS NOT NULL)::int + ("operationId" IS NOT NULL)::int + ("salesDocumentId" IS NOT NULL)::int + ("workOrderId" IS NOT NULL)::int = 1);
ALTER TABLE "BillOfMaterials" ADD CONSTRAINT "Bom_quantity_valid" CHECK ("outputQuantity" BETWEEN 1 AND 1000000);
ALTER TABLE "BillOfMaterials" ADD CONSTRAINT "Bom_code_valid" CHECK (code = upper(code) AND code ~ '^[A-Z0-9-]{2,30}$');
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_quantity_valid" CHECK (quantity BETWEEN 1 AND 1000000);
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_quantity_valid" CHECK (batches BETWEEN 1 AND 1000000 AND "outputQuantity" BETWEEN 1 AND 1000000);
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_completion_valid" CHECK (
  (status = 'COMPLETED' AND amount IS NOT NULL AND amount BETWEEN 0 AND 1000000000000 AND "completedBy" IS NOT NULL AND "completedAt" IS NOT NULL AND "completedDate" IS NOT NULL)
  OR (status <> 'COMPLETED' AND amount IS NULL AND "completedBy" IS NULL AND "completedAt" IS NULL AND "completedDate" IS NULL)
);
ALTER TABLE "WorkOrderLine" ADD CONSTRAINT "WorkOrderLine_values_valid" CHECK (quantity BETWEEN 1 AND 1000000 AND (cost IS NULL OR cost BETWEEN 0 AND 1000000000000));

CREATE FUNCTION public.erp_check_bom(p_company text, p_id text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE output_id text; n bigint;
BEGIN
  SELECT "outputItemId" INTO output_id FROM public."BillOfMaterials" WHERE "companyId" = p_company AND id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COUNT(*) INTO n FROM public."BomLine" WHERE "companyId" = p_company AND "bomId" = p_id;
  IF n NOT BETWEEN 1 AND 50 OR EXISTS (SELECT 1 FROM public."BomLine" WHERE "companyId" = p_company AND "bomId" = p_id AND "itemId" = output_id) THEN
    RAISE EXCEPTION 'BOM must contain 1-50 distinct input Items, excluding its output' USING ERRCODE = '23514';
  END IF;
END;
$$;
CREATE FUNCTION public.erp_bom_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'BillOfMaterials' THEN PERFORM public.erp_check_bom(NEW."companyId", NEW.id);
  ELSE
    IF TG_OP <> 'INSERT' THEN PERFORM public.erp_check_bom(OLD."companyId", OLD."bomId"); END IF;
    IF TG_OP <> 'DELETE' THEN PERFORM public.erp_check_bom(NEW."companyId", NEW."bomId"); END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Bom_header_check" AFTER INSERT OR UPDATE ON "BillOfMaterials" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.erp_bom_trigger();
CREATE CONSTRAINT TRIGGER "Bom_lines_check" AFTER INSERT OR UPDATE OR DELETE ON "BomLine" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.erp_bom_trigger();

CREATE FUNCTION public.erp_check_production(p_company text, p_id text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE w public."WorkOrder"%ROWTYPE; n bigint; ledger_count bigint; total numeric;
BEGIN
  SELECT * INTO w FROM public."WorkOrder" WHERE "companyId" = p_company AND id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COUNT(*), COALESCE(SUM(cost), 0) INTO n, total FROM public."WorkOrderLine" WHERE "companyId" = p_company AND "workOrderId" = p_id;
  IF n NOT BETWEEN 1 AND 50 OR EXISTS (SELECT 1 FROM public."WorkOrderLine" WHERE "companyId" = p_company AND "workOrderId" = p_id AND "itemId" = w."outputItemId") THEN
    RAISE EXCEPTION 'Work Order must contain 1-50 inputs, excluding output' USING ERRCODE = '23514';
  END IF;
  SELECT COUNT(*) INTO ledger_count FROM public."StockLedger" WHERE "companyId" = p_company AND "workOrderId" = p_id;
  IF w.status <> 'COMPLETED' THEN
    IF ledger_count <> 0 OR EXISTS (SELECT 1 FROM public."WorkOrderLine" WHERE "companyId" = p_company AND "workOrderId" = p_id AND cost IS NOT NULL) THEN
      RAISE EXCEPTION 'Uncompleted production cannot affect Stock or costs' USING ERRCODE = '23514';
    END IF;
  ELSIF ledger_count <> n + 1 OR total <> w.amount
    OR NOT EXISTS (SELECT 1 FROM public."StockLedger" WHERE "companyId" = p_company AND "workOrderId" = p_id AND "itemId" = w."outputItemId" AND quantity = w."outputQuantity" AND value = w.amount AND "warehouseId" = w."warehouseId" AND date = w."completedDate")
    OR EXISTS (SELECT 1 FROM public."WorkOrderLine" l WHERE l."companyId" = p_company AND l."workOrderId" = p_id AND (l.cost IS NULL OR NOT EXISTS (
      SELECT 1 FROM public."StockLedger" s WHERE s."companyId" = p_company AND s."workOrderId" = p_id AND s."itemId" = l."itemId" AND s.quantity = -l.quantity AND s.value = -l.cost AND s."warehouseId" = w."warehouseId" AND s.date = w."completedDate"
    ))) THEN
      RAISE EXCEPTION 'Completed production must conserve Stock value and match all material/output quantities' USING ERRCODE = '23514';
  END IF;
END;
$$;
CREATE FUNCTION public.erp_production_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'WorkOrder' THEN PERFORM public.erp_check_production(NEW."companyId", NEW.id);
  ELSE
    IF TG_OP <> 'INSERT' AND OLD."workOrderId" IS NOT NULL THEN PERFORM public.erp_check_production(OLD."companyId", OLD."workOrderId"); END IF;
    IF TG_OP <> 'DELETE' AND NEW."workOrderId" IS NOT NULL THEN PERFORM public.erp_check_production(NEW."companyId", NEW."workOrderId"); END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Production_header_check" AFTER INSERT OR UPDATE ON "WorkOrder" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.erp_production_trigger();
CREATE CONSTRAINT TRIGGER "Production_lines_check" AFTER INSERT OR UPDATE OR DELETE ON "WorkOrderLine" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.erp_production_trigger();
CREATE CONSTRAINT TRIGGER "Production_ledger_check" AFTER INSERT OR UPDATE OR DELETE ON "StockLedger" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.erp_production_trigger();
COMMIT;
