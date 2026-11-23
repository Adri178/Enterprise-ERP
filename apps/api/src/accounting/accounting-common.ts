import { requireCompanyWrite } from "../auth/write-access";
import { Prisma } from "@prisma/client";
export async function accountingAccess(tx: Prisma.TransactionClient, companyId: string, actorId: string, adminOnly = false) {
  return (await requireCompanyWrite(tx, companyId, actorId, adminOnly ? ["ADMIN"] : ["ADMIN", "MANAGER"])).company;
}
export async function accountingAudit(tx: Prisma.TransactionClient, companyId: string, actorId: string, entity: string, entityId: string, action: string, changes: unknown) {
  await tx.auditLog.create({ data: { companyId, actorId, entity, entityId, action, changes: JSON.parse(JSON.stringify(changes)) as Prisma.InputJsonValue } });
}
export const accountInclude = { parent: { select: { name: true, code: true } } } satisfies Prisma.AccountInclude;
export function serializeAccount(row: Prisma.AccountGetPayload<{ include: typeof accountInclude }>) {
  const { parent, parentId, createdAt, updatedAt, ...fields } = row;
  return { ...fields, parentId: parentId || "", parentName: parent?.name || null, parentCode: parent?.code || null, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}
export const journalInclude = { lines: { orderBy: { position: "asc" as const } }, creator: { select: { name: true } }, poster: { select: { name: true } }, reversalOf: { select: { id: true, number: true } }, reversedBy: { select: { id: true, number: true, date: true } } } satisfies Prisma.JournalInclude;
export function serializeJournal(row: Prisma.JournalGetPayload<{ include: typeof journalInclude }>) {
  const { requestKey: _key, requestHash: _hash, createdBy: _creator, postedBy: _poster, reversalOfId: _source, creator, poster, reversedBy, lines, date, createdAt, updatedAt, postedAt, amount, ...fields } = row;
  void _key; void _hash; void _creator; void _poster; void _source;
  return { ...fields, date: date.toISOString().slice(0, 10), amount: amount.toNumber(), creatorName: creator.name, posterName: poster?.name || null, postedAt: postedAt?.toISOString() || null, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString(), reversedBy: reversedBy[0] ? { ...reversedBy[0], date: reversedBy[0].date.toISOString().slice(0, 10) } : null,
    lines: lines.map(({ companyId: _company, journalId: _journal, debit, credit, ...line }) => { void _company; void _journal; return { ...line, debit: debit.toNumber(), credit: credit.toNumber() }; }),
  };
}
