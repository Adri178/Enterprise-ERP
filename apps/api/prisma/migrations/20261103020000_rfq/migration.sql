-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'OPEN', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "PurchaseDocument" ADD COLUMN     "rfqId" TEXT;

-- CreateTable
CREATE TABLE "Rfq" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "deadline" DATE NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
    "selectedOfferId" TEXT,
    "proposedBy" TEXT,
    "proposedAt" TIMESTAMP(3),
    "proposalReason" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqSupplier" (
    "companyId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,

    CONSTRAINT "RfqSupplier_pkey" PRIMARY KEY ("companyId","rfqId","supplierId")
);

-- CreateTable
CREATE TABLE "RfqOffer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(20,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqOfferLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unitPrice" DECIMAL(20,2) NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,

    CONSTRAINT "RfqOfferLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rfq_companyId_sourceId_idx" ON "Rfq"("companyId", "sourceId");

-- CreateIndex
CREATE INDEX "Rfq_companyId_status_date_idx" ON "Rfq"("companyId", "status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_companyId_id_key" ON "Rfq"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_companyId_number_key" ON "Rfq"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_companyId_requestKey_key" ON "Rfq"("companyId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "RfqOffer_companyId_rfqId_id_key" ON "RfqOffer"("companyId", "rfqId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RfqOffer_companyId_rfqId_supplierId_key" ON "RfqOffer"("companyId", "rfqId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqOfferLine_companyId_offerId_itemId_key" ON "RfqOfferLine"("companyId", "offerId", "itemId");

-- CreateIndex
CREATE INDEX "PurchaseDocument_companyId_rfqId_idx" ON "PurchaseDocument"("companyId", "rfqId");

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_companyId_rfqId_fkey" FOREIGN KEY ("companyId", "rfqId") REFERENCES "Rfq"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_companyId_sourceId_fkey" FOREIGN KEY ("companyId", "sourceId") REFERENCES "PurchaseDocument"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_proposedBy_fkey" FOREIGN KEY ("proposedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_companyId_id_selectedOfferId_fkey" FOREIGN KEY ("companyId", "id", "selectedOfferId") REFERENCES "RfqOffer"("companyId", "rfqId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RfqSupplier" ADD CONSTRAINT "RfqSupplier_companyId_rfqId_fkey" FOREIGN KEY ("companyId", "rfqId") REFERENCES "Rfq"("companyId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSupplier" ADD CONSTRAINT "RfqSupplier_companyId_supplierId_fkey" FOREIGN KEY ("companyId", "supplierId") REFERENCES "Supplier"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqOffer" ADD CONSTRAINT "RfqOffer_companyId_rfqId_fkey" FOREIGN KEY ("companyId", "rfqId") REFERENCES "Rfq"("companyId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqOffer" ADD CONSTRAINT "RfqOffer_companyId_rfqId_supplierId_fkey" FOREIGN KEY ("companyId", "rfqId", "supplierId") REFERENCES "RfqSupplier"("companyId", "rfqId", "supplierId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqOfferLine" ADD CONSTRAINT "RfqOfferLine_companyId_rfqId_offerId_fkey" FOREIGN KEY ("companyId", "rfqId", "offerId") REFERENCES "RfqOffer"("companyId", "rfqId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqOfferLine" ADD CONSTRAINT "RfqOfferLine_companyId_itemId_fkey" FOREIGN KEY ("companyId", "itemId") REFERENCES "Item"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- One active sourcing process per approved requirement. Rejection/cancellation releases it.
CREATE UNIQUE INDEX "Rfq_active_source_key" ON "Rfq" ("companyId", "sourceId") WHERE status NOT IN ('CANCELLED', 'REJECTED');
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_dates_metadata_valid" CHECK (deadline >= date AND date >= DATE '0001-01-01' AND length(description) <= 1000 AND revision >= 0 AND "requestHash" ~ '^[0-9a-f]{64}$' AND "updatedAt" >= "createdAt");
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_proposal_valid" CHECK (
  (status IN ('DRAFT','OPEN') AND "selectedOfferId" IS NULL AND "proposedBy" IS NULL AND "proposedAt" IS NULL AND "proposalReason" = '') OR
  (status IN ('PENDING','APPROVED','REJECTED') AND "selectedOfferId" IS NOT NULL AND "proposedBy" IS NOT NULL AND "proposedAt" IS NOT NULL AND length(trim("proposalReason")) BETWEEN 5 AND 500) OR status = 'CANCELLED');
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_review_valid" CHECK (
  (status IN ('APPROVED','REJECTED') AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "reviewedBy" <> "proposedBy" AND length(trim("reviewNote")) BETWEEN 5 AND 500) OR
  (status NOT IN ('APPROVED','REJECTED') AND "reviewedBy" IS NULL AND "reviewedAt" IS NULL AND "reviewNote" = ''));
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_cancellation_valid" CHECK ((status = 'CANCELLED' AND length(trim("cancelReason")) BETWEEN 5 AND 500) OR (status <> 'CANCELLED' AND "cancelReason" = ''));
ALTER TABLE "RfqOffer" ADD CONSTRAINT "RfqOffer_values_valid" CHECK (amount > 0 AND amount <= 1000000000000 AND "validUntil" >= date AND date >= DATE '0001-01-01' AND "deliveryDays" BETWEEN 0 AND 3650 AND length(trim(reference)) BETWEEN 1 AND 100 AND length(description) <= 1000);
ALTER TABLE "RfqOfferLine" ADD CONSTRAINT "RfqOfferLine_values_valid" CHECK ("unitPrice" > 0 AND "unitPrice" <= 10000000000 AND amount > 0 AND amount <= 1000000000000);
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "Purchase_rfq_order_only" CHECK ("rfqId" IS NULL OR kind = 'PURCHASE_ORDER');

-- Permit atomic parent/child cleanup without weakening the final referential state.
ALTER TABLE "Rfq" ALTER CONSTRAINT "Rfq_companyId_id_selectedOfferId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "RfqSupplier" ALTER CONSTRAINT "RfqSupplier_companyId_rfqId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "RfqOffer" ALTER CONSTRAINT "RfqOffer_companyId_rfqId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "RfqOffer" ALTER CONSTRAINT "RfqOffer_companyId_rfqId_supplierId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "RfqOfferLine" ALTER CONSTRAINT "RfqOfferLine_companyId_rfqId_offerId_fkey" DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION rfq_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' OR NEW.revision <> 0 THEN RAISE EXCEPTION 'RFQ must start as a draft'; END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status','selectedOfferId','proposedBy','proposedAt','proposalReason','reviewedBy','reviewedAt','reviewNote','cancelReason','revision','updatedAt']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','selectedOfferId','proposedBy','proposedAt','proposalReason','reviewedBy','reviewedAt','reviewNote','cancelReason','revision','updatedAt']) THEN RAISE EXCEPTION 'RFQ identity and requirements are immutable'; END IF;
  IF OLD.status IN ('APPROVED','REJECTED','CANCELLED') OR NEW.revision <> OLD.revision + 1 OR NEW."updatedAt" <= OLD."updatedAt" THEN RAISE EXCEPTION 'RFQ terminal state or revision is invalid'; END IF;
  IF NOT ((OLD.status = 'DRAFT' AND NEW.status IN ('OPEN','CANCELLED')) OR (OLD.status = 'OPEN' AND NEW.status IN ('OPEN','PENDING','CANCELLED')) OR (OLD.status = 'PENDING' AND NEW.status IN ('APPROVED','REJECTED','CANCELLED'))) THEN RAISE EXCEPTION 'RFQ transition is invalid'; END IF;
  IF OLD.status = 'PENDING' AND (NEW."selectedOfferId",NEW."proposedBy",NEW."proposedAt",NEW."proposalReason") IS DISTINCT FROM (OLD."selectedOfferId",OLD."proposedBy",OLD."proposedAt",OLD."proposalReason") THEN RAISE EXCEPTION 'RFQ proposed selection is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER rfq_identity BEFORE INSERT OR UPDATE ON "Rfq" FOR EACH ROW EXECUTE FUNCTION rfq_identity_guard();

CREATE FUNCTION rfq_child_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_company text; v_rfq text; v_status "RfqStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN v_company := OLD."companyId"; v_rfq := OLD."rfqId"; ELSE v_company := NEW."companyId"; v_rfq := NEW."rfqId"; END IF;
  IF TG_OP = 'UPDATE' AND (NEW."companyId",NEW."rfqId") IS DISTINCT FROM (OLD."companyId",OLD."rfqId") THEN RAISE EXCEPTION 'RFQ child identity is immutable'; END IF;
  SELECT status INTO v_status FROM "Rfq" WHERE "companyId" = v_company AND id = v_rfq FOR UPDATE;
  IF FOUND THEN
    IF TG_TABLE_NAME = 'RfqSupplier' THEN
      IF TG_OP <> 'INSERT' OR v_status <> 'DRAFT' THEN RAISE EXCEPTION 'RFQ Supplier invitations are immutable'; END IF;
    ELSIF v_status <> 'OPEN' THEN RAISE EXCEPTION 'RFQ offers can change only while open'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER rfq_supplier_guard BEFORE INSERT OR UPDATE OR DELETE ON "RfqSupplier" FOR EACH ROW EXECUTE FUNCTION rfq_child_guard();
CREATE TRIGGER rfq_offer_guard BEFORE INSERT OR UPDATE OR DELETE ON "RfqOffer" FOR EACH ROW EXECUTE FUNCTION rfq_child_guard();
CREATE TRIGGER rfq_offer_line_guard BEFORE INSERT OR UPDATE OR DELETE ON "RfqOfferLine" FOR EACH ROW EXECUTE FUNCTION rfq_child_guard();

CREATE FUNCTION rfq_consistency_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_company text; v_rfq text; r "Rfq"%ROWTYPE; p "PurchaseDocument"%ROWTYPE; o "RfqOffer"%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN v_company := OLD."companyId"; v_rfq := OLD."rfqId";
  ELSIF TG_TABLE_NAME = 'Rfq' THEN v_company := NEW."companyId"; v_rfq := NEW.id;
  ELSE v_company := NEW."companyId"; v_rfq := NEW."rfqId"; END IF;
  SELECT * INTO r FROM "Rfq" WHERE "companyId" = v_company AND id = v_rfq;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO p FROM "PurchaseDocument" WHERE "companyId" = r."companyId" AND id = r."sourceId" FOR UPDATE;
  IF NOT FOUND OR p.kind <> 'PURCHASE_REQUEST' OR p.status <> 'APPROVED' OR r.date < p.date THEN RAISE EXCEPTION 'RFQ requires an approved Purchase Request'; END IF;
  IF (SELECT count(*) FROM "RfqSupplier" WHERE "companyId" = v_company AND "rfqId" = v_rfq) NOT BETWEEN 2 AND 10 THEN RAISE EXCEPTION 'RFQ requires two to ten Supplier invitations'; END IF;
  FOR o IN SELECT * FROM "RfqOffer" WHERE "companyId" = v_company AND "rfqId" = v_rfq LOOP
    IF o.date < r.date OR o.date > r.deadline OR o.amount <> (SELECT coalesce(sum(amount),0) FROM "RfqOfferLine" WHERE "companyId" = v_company AND "offerId" = o.id) OR
       EXISTS (SELECT 1 FROM "PurchaseLine" l FULL JOIN "RfqOfferLine" q ON q."companyId" = v_company AND q."offerId" = o.id AND l."itemId" = q."itemId" AND l."companyId" = v_company AND l."documentId" = p.id
         WHERE (l."companyId" = v_company AND l."documentId" = p.id OR q."companyId" = v_company AND q."offerId" = o.id) AND (l.id IS NULL OR q.id IS NULL OR q.amount <> l.quantity * q."unitPrice"))
       THEN RAISE EXCEPTION 'RFQ offer must match all Purchase Request Items and quantities'; END IF;
  END LOOP;
  IF r.status IN ('PENDING','APPROVED','REJECTED') AND (SELECT count(*) FROM "RfqOffer" WHERE "companyId" = v_company AND "rfqId" = v_rfq) < 2 THEN RAISE EXCEPTION 'RFQ selection requires two offers'; END IF;
  IF EXISTS (SELECT 1 FROM "PurchaseDocument" d WHERE d."companyId" = v_company AND d."sourceId" = p.id AND d.kind = 'PURCHASE_ORDER' AND d.status <> 'CANCELLED' AND r.status NOT IN ('CANCELLED','REJECTED') AND (d."rfqId" IS DISTINCT FROM r.id OR r.status <> 'APPROVED')) THEN RAISE EXCEPTION 'Active RFQ must authorize its Purchase Order'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER rfq_consistency AFTER INSERT OR UPDATE ON "Rfq" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rfq_consistency_guard();
CREATE CONSTRAINT TRIGGER rfq_supplier_consistency AFTER INSERT OR UPDATE OR DELETE ON "RfqSupplier" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rfq_consistency_guard();
CREATE CONSTRAINT TRIGGER rfq_offer_consistency AFTER INSERT OR UPDATE OR DELETE ON "RfqOffer" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rfq_consistency_guard();
CREATE CONSTRAINT TRIGGER rfq_line_consistency AFTER INSERT OR UPDATE OR DELETE ON "RfqOfferLine" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rfq_consistency_guard();

CREATE FUNCTION rfq_purchase_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "Rfq"%ROWTYPE; o "RfqOffer"%ROWTYPE; p "PurchaseDocument"%ROWTYPE; d "PurchaseDocument"%ROWTYPE; v_company text; v_document text;
BEGIN
  IF TG_TABLE_NAME = 'PurchaseDocument' THEN v_company := NEW."companyId"; v_document := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN v_company := OLD."companyId"; v_document := OLD."documentId";
  ELSE v_company := NEW."companyId"; v_document := NEW."documentId"; END IF;
  SELECT * INTO d FROM "PurchaseDocument" WHERE "companyId" = v_company AND id = v_document;
  IF NOT FOUND OR d.kind <> 'PURCHASE_ORDER' THEN RETURN NULL; END IF;
  PERFORM id FROM "PurchaseDocument" WHERE "companyId" = d."companyId" AND id = d."sourceId" FOR UPDATE;
  IF d."rfqId" IS NULL THEN
    IF d.status <> 'CANCELLED' AND EXISTS (SELECT 1 FROM "Rfq" WHERE "companyId" = d."companyId" AND "sourceId" = d."sourceId" AND status NOT IN ('CANCELLED','REJECTED')) THEN RAISE EXCEPTION 'Purchase Order must use the approved active RFQ'; END IF;
    RETURN NULL;
  END IF;
  SELECT * INTO r FROM "Rfq" WHERE "companyId" = d."companyId" AND id = d."rfqId";
  SELECT * INTO o FROM "RfqOffer" WHERE "companyId" = r."companyId" AND "rfqId" = r.id AND id = r."selectedOfferId";
  SELECT * INTO p FROM "PurchaseDocument" WHERE "companyId" = r."companyId" AND id = r."sourceId";
  IF r.status IS DISTINCT FROM 'APPROVED' OR d."sourceId" IS DISTINCT FROM r."sourceId" OR d."supplierId" IS DISTINCT FROM o."supplierId" OR d.amount IS DISTINCT FROM o.amount OR d.currency IS DISTINCT FROM p.currency OR d."warehouseId" IS DISTINCT FROM p."warehouseId" OR d.date < r.date OR d.date < o.date OR d.date > o."validUntil" THEN RAISE EXCEPTION 'Purchase Order must match its approved RFQ selection'; END IF;
  IF EXISTS (SELECT 1 FROM "PurchaseLine" l FULL JOIN "RfqOfferLine" q ON q."companyId" = d."companyId" AND q."offerId" = o.id AND l."itemId" = q."itemId" AND l."companyId" = d."companyId" AND l."documentId" = d.id
    WHERE (l."companyId" = d."companyId" AND l."documentId" = d.id OR q."companyId" = d."companyId" AND q."offerId" = o.id) AND (l.id IS NULL OR q.id IS NULL OR l."unitPrice" <> q."unitPrice" OR l.amount <> q.amount OR l.quantity IS DISTINCT FROM (SELECT quantity FROM "PurchaseLine" WHERE "companyId" = d."companyId" AND "documentId" = r."sourceId" AND "itemId" = l."itemId"))) THEN RAISE EXCEPTION 'Purchase Order lines must match the approved RFQ offer'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER rfq_purchase_consistency AFTER INSERT OR UPDATE ON "PurchaseDocument" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rfq_purchase_guard();
CREATE CONSTRAINT TRIGGER rfq_purchase_line_consistency AFTER INSERT OR UPDATE OR DELETE ON "PurchaseLine" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION rfq_purchase_guard();

CREATE FUNCTION rfq_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_id text; v_company text;
BEGIN
  IF TG_OP = 'INSERT' THEN source_id := NEW."documentId"; v_company := NEW."companyId";
  ELSIF TG_TABLE_NAME = 'PurchaseDocument' THEN source_id := OLD.id; v_company := OLD."companyId";
  ELSE source_id := OLD."documentId"; v_company := OLD."companyId"; END IF;
  PERFORM id FROM "PurchaseDocument" WHERE "companyId" = v_company AND id = source_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "Rfq" WHERE "companyId" = v_company AND "sourceId" = source_id) THEN RAISE EXCEPTION 'RFQ Purchase Request history is immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER rfq_source_document BEFORE UPDATE OR DELETE ON "PurchaseDocument" FOR EACH ROW EXECUTE FUNCTION rfq_source_guard();
CREATE TRIGGER rfq_source_line BEFORE INSERT OR UPDATE OR DELETE ON "PurchaseLine" FOR EACH ROW EXECUTE FUNCTION rfq_source_guard();
