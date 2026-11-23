-- Release an approved sourcing award only when no active Purchase Order exists.
-- The selected offer and original review remain immutable historical facts.
ALTER TABLE "Rfq" DROP CONSTRAINT "Rfq_review_valid";
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_review_valid" CHECK (
  (status IN ('APPROVED','REJECTED','CANCELLED') AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "proposedBy" IS NOT NULL AND "reviewedBy" <> "proposedBy" AND length(trim("reviewNote")) BETWEEN 5 AND 500) OR
  (status NOT IN ('APPROVED','REJECTED') AND "reviewedBy" IS NULL AND "reviewedAt" IS NULL AND "reviewNote" = ''));

CREATE OR REPLACE FUNCTION rfq_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' OR NEW.revision <> 0 THEN RAISE EXCEPTION 'RFQ must start as a draft'; END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status','selectedOfferId','proposedBy','proposedAt','proposalReason','reviewedBy','reviewedAt','reviewNote','cancelReason','revision','updatedAt']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','selectedOfferId','proposedBy','proposedAt','proposalReason','reviewedBy','reviewedAt','reviewNote','cancelReason','revision','updatedAt']) THEN RAISE EXCEPTION 'RFQ identity and requirements are immutable'; END IF;
  IF OLD.status IN ('REJECTED','CANCELLED') OR (OLD.status = 'APPROVED' AND NEW.status <> 'CANCELLED') OR NEW.revision <> OLD.revision + 1 OR NEW."updatedAt" <= OLD."updatedAt" THEN RAISE EXCEPTION 'RFQ terminal state or revision is invalid'; END IF;
  IF NOT ((OLD.status = 'DRAFT' AND NEW.status IN ('OPEN','CANCELLED')) OR (OLD.status = 'OPEN' AND NEW.status IN ('OPEN','PENDING','CANCELLED')) OR (OLD.status = 'PENDING' AND NEW.status IN ('APPROVED','REJECTED','CANCELLED')) OR (OLD.status = 'APPROVED' AND NEW.status = 'CANCELLED')) THEN RAISE EXCEPTION 'RFQ transition is invalid'; END IF;
  IF OLD.status = 'PENDING' AND (NEW."selectedOfferId",NEW."proposedBy",NEW."proposedAt",NEW."proposalReason") IS DISTINCT FROM (OLD."selectedOfferId",OLD."proposedBy",OLD."proposedAt",OLD."proposalReason") THEN RAISE EXCEPTION 'RFQ proposed selection is immutable'; END IF;
  IF NEW.status = 'CANCELLED' AND (to_jsonb(NEW) - ARRAY['status','cancelReason','revision','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','cancelReason','revision','updatedAt']) THEN RAISE EXCEPTION 'RFQ cancellation must retain the previous award and review'; END IF;
  IF NEW.status = 'CANCELLED' THEN
    PERFORM id FROM "PurchaseDocument" WHERE "companyId" = OLD."companyId" AND id = OLD."sourceId" FOR UPDATE;
    IF EXISTS (SELECT 1 FROM "PurchaseDocument" WHERE "companyId" = OLD."companyId" AND "rfqId" = OLD.id AND status <> 'CANCELLED') THEN RAISE EXCEPTION 'RFQ with an active Purchase Order cannot be cancelled'; END IF;
  END IF;
  RETURN NEW;
END $$;
