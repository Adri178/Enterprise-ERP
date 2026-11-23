BEGIN;
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "date" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "postedBy" TEXT,
    "postedAt" TIMESTAMP(3),
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "position" INTEGER NOT NULL,
    "debit" DECIMAL(20,2) NOT NULL,
    "credit" DECIMAL(20,2) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_companyId_type_status_code_idx" ON "Account"("companyId", "type", "status", "code");

-- CreateIndex
CREATE INDEX "Account_companyId_parentId_idx" ON "Account"("companyId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_companyId_id_key" ON "Account"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Account_companyId_id_type_key" ON "Account"("companyId", "id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Account_companyId_code_key" ON "Account"("companyId", "code");

-- CreateIndex
CREATE INDEX "Journal_companyId_status_date_idx" ON "Journal"("companyId", "status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Journal_companyId_id_key" ON "Journal"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Journal_companyId_number_key" ON "Journal"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Journal_companyId_requestKey_key" ON "Journal"("companyId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Journal_companyId_reversalOfId_key" ON "Journal"("companyId", "reversalOfId");

-- CreateIndex
CREATE INDEX "JournalLine_companyId_accountId_journalId_idx" ON "JournalLine"("companyId", "accountId", "journalId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_companyId_journalId_position_key" ON "JournalLine"("companyId", "journalId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_companyId_journalId_accountId_key" ON "JournalLine"("companyId", "journalId", "accountId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_parentId_type_fkey" FOREIGN KEY ("companyId", "parentId", "type") REFERENCES "Account"("companyId", "id", "type") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_postedBy_fkey" FOREIGN KEY ("postedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_companyId_reversalOfId_fkey" FOREIGN KEY ("companyId", "reversalOfId") REFERENCES "Journal"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_companyId_journalId_fkey" FOREIGN KEY ("companyId", "journalId") REFERENCES "Journal"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_companyId_accountId_accountType_fkey" FOREIGN KEY ("companyId", "accountId", "accountType") REFERENCES "Account"("companyId", "id", "type") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Account" ADD CONSTRAINT "Account_structure_check" CHECK (("parentId" IS NOT NULL OR "isGroup") AND ("parentId" IS NULL OR "parentId" <> id));
ALTER TABLE "Account" ADD CONSTRAINT "Account_code_check" CHECK (code = upper(code) AND code ~ '^[A-Z0-9-]{2,20}$');
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_amount_check" CHECK (amount > 0 AND amount <= 1000000000000);
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_posting_check" CHECK (
  (status = 'POSTED' AND "postedAt" IS NOT NULL AND "postedBy" IS NOT NULL)
  OR (status <> 'POSTED' AND "postedAt" IS NULL AND "postedBy" IS NULL AND "reversalOfId" IS NULL)
);
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_reversal_self_check" CHECK ("reversalOfId" IS NULL OR "reversalOfId" <> id);
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_sides_check" CHECK (
  debit >= 0 AND credit >= 0 AND debit <= 1000000000000 AND credit <= 1000000000000
  AND ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)) AND position BETWEEN 1 AND 50
);

-- Validate the complete document at commit, after nested line replacement has finished.
CREATE FUNCTION public.erp_check_journal_balance(p_company text, p_journal text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE expected numeric; actual_debit numeric; actual_credit numeric; line_count bigint;
BEGIN
  SELECT amount INTO expected FROM public."Journal" WHERE "companyId" = p_company AND id = p_journal;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COUNT(*), COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO line_count, actual_debit, actual_credit
    FROM public."JournalLine" WHERE "companyId" = p_company AND "journalId" = p_journal;
  IF line_count < 2 OR line_count > 50 OR actual_debit <> expected OR actual_credit <> expected THEN
    RAISE EXCEPTION 'Journal debit, credit and header amount must balance with 2-50 lines'
      USING ERRCODE = '23514', CONSTRAINT = 'Journal_balanced_check';
  END IF;
END;
$$;
CREATE FUNCTION public.erp_journal_balance_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'Journal' THEN
    PERFORM public.erp_check_journal_balance(NEW."companyId", NEW.id);
  ELSE
    IF TG_OP <> 'INSERT' THEN PERFORM public.erp_check_journal_balance(OLD."companyId", OLD."journalId"); END IF;
    IF TG_OP <> 'DELETE' THEN PERFORM public.erp_check_journal_balance(NEW."companyId", NEW."journalId"); END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Journal_balanced_header" AFTER INSERT OR UPDATE ON "Journal"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.erp_journal_balance_trigger();
CREATE CONSTRAINT TRIGGER "Journal_balanced_lines" AFTER INSERT OR UPDATE OR DELETE ON "JournalLine"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.erp_journal_balance_trigger();
COMMIT;
