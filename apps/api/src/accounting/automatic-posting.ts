import { ConflictException } from "@nestjs/common";
import { Prisma, type JournalOrigin } from "@prisma/client";
import { randomUUID, createHash } from "node:crypto";
import { purposeAccountTypes, type AccountingPurpose, type OpeningSnapshot } from "@erp/shared";
import { accountingAudit } from "./accounting-common";
type Tx = Prisma.TransactionClient;
export const policyInclude = { mappings: { include: { account: true } }, openingJournal: { select: { id: true, number: true } } } satisfies Prisma.AccountingPolicyInclude;
type Policy = Prisma.AccountingPolicyGetPayload<{ include: typeof policyInclude }>;
type Entries = Partial<Record<AccountingPurpose, Prisma.Decimal>>;
const zero = () => new Prisma.Decimal(0);
const sum = (values: Prisma.Decimal[]) => values.reduce((n, v) => n.add(v), zero());
export async function openingSnapshot(tx: Tx, companyId: string): Promise<OpeningSnapshot> {
  const [r] = await tx.$queryRaw<{ inventory: string; receivable: string; payable: string; grni: string; latestDate: string | null; events: string }[]>`
    WITH p AS (SELECT * FROM "PurchaseDocument" WHERE "companyId"=${companyId} AND status='POSTED'),
         s AS (SELECT * FROM "SalesDocument" WHERE "companyId"=${companyId} AND status='POSTED'),
         dates AS (
           SELECT date, "updatedAt" FROM p WHERE kind IN ('PURCHASE_RECEIPT','PURCHASE_INVOICE','PAYMENT')
           UNION ALL SELECT date, "updatedAt" FROM s WHERE kind IN ('DELIVERY_NOTE','SALES_INVOICE','PAYMENT')
           UNION ALL SELECT date, "updatedAt" FROM "StockOperation" WHERE "companyId"=${companyId} AND status='POSTED'
           UNION ALL SELECT "completedDate", "updatedAt" FROM "WorkOrder" WHERE "companyId"=${companyId} AND status='COMPLETED'
         )
    SELECT COALESCE((SELECT SUM(value) FROM "StockBalance" WHERE "companyId"=${companyId}),0)::text inventory,
      COALESCE((SELECT SUM(CASE WHEN kind='SALES_INVOICE' THEN amount WHEN kind='PAYMENT' THEN -amount ELSE 0 END) FROM s),0)::text receivable,
      COALESCE((SELECT SUM(CASE WHEN kind='PURCHASE_INVOICE' THEN amount WHEN kind='PAYMENT' THEN -amount ELSE 0 END) FROM p),0)::text payable,
      COALESCE((SELECT SUM(amount) FROM p r WHERE kind='PURCHASE_RECEIPT' AND NOT EXISTS
        (SELECT 1 FROM p i WHERE i."sourceId"=r.id AND i.kind='PURCHASE_INVOICE')),0)::text grni,
      (SELECT MAX(date)::text FROM dates) AS "latestDate",
      (SELECT COUNT(*)::text || ':' || COALESCE(MAX("updatedAt")::text,'') FROM dates) AS events`;
  const values = { inventory: new Prisma.Decimal(r.inventory).toFixed(2), receivable: new Prisma.Decimal(r.receivable).toFixed(2), payable: new Prisma.Decimal(r.payable).toFixed(2), grni: new Prisma.Decimal(r.grni).toFixed(2) };
  if (Object.values(values).some((v) => new Prisma.Decimal(v).isNegative())) throw new ConflictException("Saldo operasional tidak valid untuk aktivasi Accounting");
  const equity = new Prisma.Decimal(values.inventory).add(values.receivable).sub(values.payable).sub(values.grni).toFixed(2);
  return { ...values, equity, latestDate: r.latestDate, snapshotKey: createHash("sha256").update(JSON.stringify({ ...values, equity, latestDate: r.latestDate, events: r.events })).digest("hex") };
}
export function serializePolicy(row: Policy | null, opening: OpeningSnapshot) {
  return { enabled: !!row, effectiveFrom: row?.effectiveFrom.toISOString().slice(0, 10) || null, createdAt: row?.createdAt.toISOString() || null, opening: row ? row.opening as unknown as OpeningSnapshot : opening,
    mappings: Object.fromEntries((row?.mappings || []).map((m) => [m.purpose, { accountId: m.accountId, code: m.account.code, name: m.account.name }])), openingJournal: row?.openingJournal || null };
}
export async function automaticJournal(tx: Tx, companyId: string, actorId: string, policy: Pick<Policy, "mappings">, date: Date, origin: JournalOrigin, reference: string, description: string, entries: Entries) {
  const used = Object.entries(entries).filter(([, value]) => !value!.isZero()) as [AccountingPurpose, Prisma.Decimal][];
  if (!used.length) return null;
  const lines = used.map(([purpose, value], index) => {
    const mapping = policy.mappings.find((m) => m.purpose === purpose), account = mapping?.account;
    if (!account || account.companyId !== companyId || account.isGroup || account.status !== "ACTIVE" || account.type !== purposeAccountTypes[purpose]) throw new ConflictException(`Mapping Account ${purpose} tidak valid. Posting dibatalkan.`);
    return { accountId: account.id, accountCode: account.code, accountName: account.name, accountType: account.type, position: index + 1, description, debit: value.isPositive() ? value : zero(), credit: value.isNegative() ? value.neg() : zero() };
  });
  const debit = sum(lines.map((l) => l.debit)), credit = sum(lines.map((l) => l.credit));
  if (!debit.eq(credit) || debit.gt(1e12) || lines.length < 2) throw new ConflictException("Journal otomatis tidak seimbang atau melebihi batas nilai");
  const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } }), year = date.getUTCFullYear(), prefix = origin === "OPENING" ? "JVO" : "JVA";
  const sequence = await tx.documentSequence.upsert({ where: { companyId_prefix_year: { companyId, prefix, year } }, create: { companyId, prefix, year, value: 1 }, update: { value: { increment: 1 } } });
  const row = await tx.journal.create({ data: { companyId, number: `${prefix}-${company.code}-${year}-${String(sequence.value).padStart(5, "0")}`, requestKey: randomUUID(), requestHash: createHash("sha256").update(`${origin}:${reference}`).digest("hex"), origin, status: "POSTED", date, currency: company.currency, reference, description, amount: debit, createdBy: actorId, postedBy: actorId, postedAt: new Date(), lines: { create: lines } } });
  await accountingAudit(tx, companyId, actorId, "journals", row.id, "AUTO_POST", { origin, reference, number: row.number, amount: debit.toFixed(2) });
  return row;
}
export type PostingSource = { purchaseId: string } | { salesId: string } | { operationId: string } | { workOrderId: string };
export async function postOperationalAccounting(tx: Tx, companyId: string, actorId: string, source: PostingSource) {
  const policy = await tx.accountingPolicy.findUnique({ where: { companyId }, include: policyInclude });
  if (!policy) return;
  let entries: Entries = {}, number = "", kind = "", date = new Date(), parent: { date: Date } | null = null;
  if ("purchaseId" in source) {
    const row = await tx.purchaseDocument.findUniqueOrThrow({ where: { companyId_id: { companyId, id: source.purchaseId } }, include: { source: true } });
    if (!["PURCHASE_RECEIPT", "PURCHASE_INVOICE", "PAYMENT"].includes(row.kind)) return;
    if (row.status !== "POSTED") throw new ConflictException("Dokumen belum dibukukan");
    ({ number, kind, date } = row); parent = row.kind === "PURCHASE_RECEIPT" ? null : row.source;
    if (row.kind === "PURCHASE_RECEIPT") entries = { INVENTORY: row.amount, GRNI: row.amount.neg() };
    if (row.kind === "PURCHASE_INVOICE") entries = { GRNI: row.amount, PAYABLE: row.amount.neg() };
    if (row.kind === "PAYMENT") entries = { PAYABLE: row.amount, CASH: row.amount.neg() };
  } else if ("salesId" in source) {
    const row = await tx.salesDocument.findUniqueOrThrow({ where: { companyId_id: { companyId, id: source.salesId } }, include: { source: true, lines: true } });
    if (!["DELIVERY_NOTE", "SALES_INVOICE", "PAYMENT"].includes(row.kind)) return;
    if (row.status !== "POSTED") throw new ConflictException("Dokumen belum dibukukan");
    ({ number, kind, date } = row); parent = row.kind === "DELIVERY_NOTE" ? null : row.source;
    if (row.kind === "DELIVERY_NOTE") { const cost = sum(row.lines.map((l) => l.stockCost || zero())); entries = { COGS: cost, INVENTORY: cost.neg() }; }
    if (row.kind === "SALES_INVOICE") entries = { RECEIVABLE: row.amount, REVENUE: row.amount.neg() };
    if (row.kind === "PAYMENT") entries = { CASH: row.amount, RECEIVABLE: row.amount.neg() };
  } else if ("operationId" in source) {
    const row = await tx.stockOperation.findUniqueOrThrow({ where: { companyId_id: { companyId, id: source.operationId } }, include: { lines: true } });
    if (row.status !== "POSTED") throw new ConflictException("Stock belum dibukukan");
    ({ number, kind, date } = row);
    if (row.kind === "ADJUSTMENT") { const additions = sum(row.lines.filter((l) => l.quantity > 0).map((l) => l.value || zero())), losses = sum(row.lines.filter((l) => l.quantity < 0).map((l) => (l.value || zero()).abs())); entries = { INVENTORY: additions.sub(losses), STOCK_GAIN: additions.neg(), STOCK_LOSS: losses }; }
  } else {
    const row = await tx.workOrder.findUniqueOrThrow({ where: { companyId_id: { companyId, id: source.workOrderId } } });
    if (row.status !== "COMPLETED" || !row.completedDate) throw new ConflictException("Work Order belum selesai");
    number = row.number; kind = "WORK_ORDER"; date = row.completedDate;
  }
  if (date < policy.effectiveFrom) throw new ConflictException("Tanggal posting mendahului aktivasi Accounting. Gunakan tanggal mulai Accounting atau sesudahnya.");
  // The opening snapshot covers every legacy posted Receipt/Invoice before this boundary.
  if (parent && parent.date >= policy.effectiveFrom) {
    const parentId = "purchaseId" in source ? (await tx.purchaseDocument.findUniqueOrThrow({ where: { id: source.purchaseId } })).sourceId : (await tx.salesDocument.findUniqueOrThrow({ where: { id: (source as { salesId: string }).salesId } })).sourceId;
    const covered = await tx.operationalPosting.findFirst({ where: { companyId, ...("purchaseId" in source ? { purchaseId: parentId } : { salesId: parentId }) } });
    if (!covered) throw new ConflictException("Dokumen sumber belum memiliki pencatatan Accounting");
  }
  const note = Object.values(entries).every((v) => v!.isZero()) ? "Tidak ada perubahan nilai financial; Stock tetap dicatat pada ledger." : "Journal otomatis dari transaksi operasional";
  const journal = await automaticJournal(tx, companyId, actorId, policy, date, "OPERATIONAL", number, `${kind} · ${number}`, entries);
  await tx.operationalPosting.create({ data: { companyId, ...source, journalId: journal?.id, number, kind, date, amount: journal?.amount || zero(), note } });
}
