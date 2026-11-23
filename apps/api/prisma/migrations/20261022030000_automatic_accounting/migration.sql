BEGIN;
-- CreateEnum
CREATE TYPE "JournalOrigin" AS ENUM ('MANUAL', 'OPENING', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "AccountingPurpose" AS ENUM ('INVENTORY', 'GRNI', 'PAYABLE', 'RECEIVABLE', 'CASH', 'REVENUE', 'COGS', 'STOCK_GAIN', 'STOCK_LOSS', 'OPENING_EQUITY');

-- AlterTable
ALTER TABLE "Journal" ADD COLUMN     "origin" "JournalOrigin" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "AccountingPolicy" (
    "companyId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opening" JSONB NOT NULL,
    "openingJournalId" TEXT,

    CONSTRAINT "AccountingPolicy_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "AccountingMapping" (
    "companyId" TEXT NOT NULL,
    "purpose" "AccountingPurpose" NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,

    CONSTRAINT "AccountingMapping_pkey" PRIMARY KEY ("companyId","purpose")
);

-- CreateTable
CREATE TABLE "OperationalPosting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "salesId" TEXT,
    "operationId" TEXT,
    "workOrderId" TEXT,
    "journalId" TEXT,
    "number" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalPosting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPolicy_companyId_openingJournalId_key" ON "AccountingPolicy"("companyId", "openingJournalId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingMapping_companyId_accountId_key" ON "AccountingMapping"("companyId", "accountId");

-- CreateIndex
CREATE INDEX "OperationalPosting_companyId_date_idx" ON "OperationalPosting"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalPosting_companyId_journalId_key" ON "OperationalPosting"("companyId", "journalId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalPosting_companyId_purchaseId_key" ON "OperationalPosting"("companyId", "purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalPosting_companyId_salesId_key" ON "OperationalPosting"("companyId", "salesId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalPosting_companyId_operationId_key" ON "OperationalPosting"("companyId", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalPosting_companyId_workOrderId_key" ON "OperationalPosting"("companyId", "workOrderId");

-- AddForeignKey
ALTER TABLE "AccountingPolicy" ADD CONSTRAINT "AccountingPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPolicy" ADD CONSTRAINT "AccountingPolicy_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPolicy" ADD CONSTRAINT "AccountingPolicy_companyId_openingJournalId_fkey" FOREIGN KEY ("companyId", "openingJournalId") REFERENCES "Journal"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingMapping" ADD CONSTRAINT "AccountingMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "AccountingPolicy"("companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingMapping" ADD CONSTRAINT "AccountingMapping_companyId_accountId_accountType_fkey" FOREIGN KEY ("companyId", "accountId", "accountType") REFERENCES "Account"("companyId", "id", "type") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperationalPosting" ADD CONSTRAINT "OperationalPosting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalPosting" ADD CONSTRAINT "OperationalPosting_companyId_journalId_fkey" FOREIGN KEY ("companyId", "journalId") REFERENCES "Journal"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalPosting" ADD CONSTRAINT "OperationalPosting_companyId_purchaseId_fkey" FOREIGN KEY ("companyId", "purchaseId") REFERENCES "PurchaseDocument"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalPosting" ADD CONSTRAINT "OperationalPosting_companyId_salesId_fkey" FOREIGN KEY ("companyId", "salesId") REFERENCES "SalesDocument"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalPosting" ADD CONSTRAINT "OperationalPosting_companyId_operationId_fkey" FOREIGN KEY ("companyId", "operationId") REFERENCES "StockOperation"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalPosting" ADD CONSTRAINT "OperationalPosting_companyId_workOrderId_fkey" FOREIGN KEY ("companyId", "workOrderId") REFERENCES "WorkOrder"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingMapping" ADD CONSTRAINT "AccountingMapping_purpose_type_check" CHECK (
  "accountType" = CASE
    WHEN purpose IN ('INVENTORY','RECEIVABLE','CASH') THEN 'ASSET'::"AccountType"
    WHEN purpose IN ('GRNI','PAYABLE') THEN 'LIABILITY'::"AccountType"
    WHEN purpose IN ('REVENUE','STOCK_GAIN') THEN 'INCOME'::"AccountType"
    WHEN purpose IN ('COGS','STOCK_LOSS') THEN 'EXPENSE'::"AccountType"
    ELSE 'EQUITY'::"AccountType" END);
ALTER TABLE "OperationalPosting" ADD CONSTRAINT "OperationalPosting_source_check" CHECK (
  num_nonnulls("purchaseId","salesId","operationId","workOrderId") = 1 AND amount >= 0 AND amount <= 1000000000000
  AND ((amount = 0 AND "journalId" IS NULL) OR (amount > 0 AND "journalId" IS NOT NULL)));
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_automatic_status_check" CHECK (
  origin = 'MANUAL' OR (status = 'POSTED' AND "reversalOfId" IS NULL));

CREATE FUNCTION public.erp_check_automatic_journal(p_company text, p_id text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE j public."Journal"; p public."OperationalPosting"; policy public."AccountingPolicy";
BEGIN
  SELECT * INTO j FROM public."Journal" WHERE "companyId"=p_company AND id=p_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF j.origin = 'OPERATIONAL' THEN
    SELECT * INTO p FROM public."OperationalPosting" WHERE "companyId"=p_company AND "journalId"=p_id;
    IF NOT FOUND OR p.amount <> j.amount OR p.date <> j.date OR p.number <> j.reference THEN
      RAISE EXCEPTION 'Automatic Journal must match its operational source' USING ERRCODE='23514';
    END IF;
  ELSIF j.origin = 'OPENING' THEN
    SELECT * INTO policy FROM public."AccountingPolicy" WHERE "companyId"=p_company AND "openingJournalId"=p_id;
    IF NOT FOUND OR policy."effectiveFrom" <> j.date THEN
      RAISE EXCEPTION 'Opening Journal must match its Accounting policy' USING ERRCODE='23514';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public."OperationalPosting" WHERE "companyId"=p_company AND "journalId"=p_id)
     OR EXISTS (SELECT 1 FROM public."AccountingPolicy" WHERE "companyId"=p_company AND "openingJournalId"=p_id) THEN
    RAISE EXCEPTION 'Manual Journal cannot represent an automatic source' USING ERRCODE='23514';
  END IF;
END;
$$;
CREATE FUNCTION public.erp_automatic_consistency_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p public."OperationalPosting"; source_date date; source_number text; source_kind text; source_status text; c text; source_id text;
BEGIN
  IF TG_TABLE_NAME='Journal' THEN
    PERFORM public.erp_check_automatic_journal(NEW."companyId",NEW.id);
    RETURN NULL;
  END IF;
  c := CASE WHEN TG_OP='DELETE' THEN OLD."companyId" ELSE NEW."companyId" END;
  IF TG_TABLE_NAME='AccountingPolicy' OR TG_TABLE_NAME='AccountingMapping' THEN
    IF EXISTS (SELECT 1 FROM public."AccountingPolicy" WHERE "companyId"=c) AND
      (SELECT COUNT(*) FROM public."AccountingMapping" WHERE "companyId"=c) <> 10 THEN
      RAISE EXCEPTION 'Accounting policy requires all ten mappings' USING ERRCODE='23514';
    END IF;
    IF TG_TABLE_NAME='AccountingPolicy' THEN
      IF TG_OP<>'INSERT' THEN PERFORM public.erp_check_automatic_journal(c,OLD."openingJournalId"); END IF;
      IF TG_OP<>'DELETE' THEN PERFORM public.erp_check_automatic_journal(c,NEW."openingJournalId"); END IF;
    END IF;
    RETURN NULL;
  END IF;
  IF TG_OP<>'INSERT' THEN PERFORM public.erp_check_automatic_journal(c,OLD."journalId"); END IF;
  IF TG_OP='DELETE' THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public."OperationalPosting" WHERE id=NEW.id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p."purchaseId" IS NOT NULL THEN
    SELECT date,number,kind::text,status::text INTO source_date,source_number,source_kind,source_status FROM public."PurchaseDocument" WHERE "companyId"=c AND id=p."purchaseId" AND kind IN ('PURCHASE_RECEIPT','PURCHASE_INVOICE','PAYMENT');
  ELSIF p."salesId" IS NOT NULL THEN
    SELECT date,number,kind::text,status::text INTO source_date,source_number,source_kind,source_status FROM public."SalesDocument" WHERE "companyId"=c AND id=p."salesId" AND kind IN ('DELIVERY_NOTE','SALES_INVOICE','PAYMENT');
  ELSIF p."operationId" IS NOT NULL THEN
    SELECT date,number,kind::text,status::text INTO source_date,source_number,source_kind,source_status FROM public."StockOperation" WHERE "companyId"=c AND id=p."operationId";
  ELSE
    SELECT "completedDate",number,'WORK_ORDER',CASE WHEN status='COMPLETED' THEN 'POSTED' ELSE status::text END INTO source_date,source_number,source_kind,source_status FROM public."WorkOrder" WHERE "companyId"=c AND id=p."workOrderId";
  END IF;
  IF source_status IS DISTINCT FROM 'POSTED' OR source_date IS DISTINCT FROM p.date OR source_number IS DISTINCT FROM p.number OR source_kind IS DISTINCT FROM p.kind
    OR NOT EXISTS (SELECT 1 FROM public."AccountingPolicy" WHERE "companyId"=c AND "effectiveFrom"<=p.date) THEN
    RAISE EXCEPTION 'Accounting source must be posted in the same policy period' USING ERRCODE='23514';
  END IF;
  IF p."journalId" IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public."Journal" WHERE "companyId"=c AND id=p."journalId" AND origin='OPERATIONAL') THEN
      RAISE EXCEPTION 'Accounting source requires an operational Journal' USING ERRCODE='23514';
    END IF;
    PERFORM public.erp_check_automatic_journal(c,p."journalId");
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Journal_automatic_consistency" AFTER INSERT OR UPDATE ON "Journal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.erp_automatic_consistency_trigger();
CREATE CONSTRAINT TRIGGER "OperationalPosting_consistency" AFTER INSERT OR UPDATE OR DELETE ON "OperationalPosting" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.erp_automatic_consistency_trigger();
CREATE CONSTRAINT TRIGGER "AccountingPolicy_consistency" AFTER INSERT OR UPDATE OR DELETE ON "AccountingPolicy" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.erp_automatic_consistency_trigger();
CREATE CONSTRAINT TRIGGER "AccountingMapping_complete" AFTER INSERT OR UPDATE OR DELETE ON "AccountingMapping" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.erp_automatic_consistency_trigger();
COMMIT;
