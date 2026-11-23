import { requireCompanyWrite } from "../auth/write-access";
import { Prisma } from "@prisma/client";
export async function hrAccess(tx: Prisma.TransactionClient, companyId: string, actorId: string) {
  return requireCompanyWrite(tx, companyId, actorId);
}
export const employeeInclude = {
  branch: { include: { record: { select: { name: true, status: true } } } },
  department: { include: { record: { select: { name: true, status: true } } } },
} satisfies Prisma.EmployeeInclude;
export function serializeEmployee(
  row: Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>,
) {
  const {
    branch,
    department,
    startDate,
    endDate,
    createdAt,
    updatedAt,
    ...fields
  } = row;
  return {
    ...fields,
    branchName: branch.record.name,
    departmentName: department.record.name,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate?.toISOString().slice(0, 10) || "",
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}
export const leaveInclude = {
  creator: { select: { name: true } },
  reviewer: { select: { name: true } },
} satisfies Prisma.LeaveRequestInclude;
export function serializeLeave(
  row: Prisma.LeaveRequestGetPayload<{ include: typeof leaveInclude }>,
) {
  const {
    requestKey: _key,
    requestHash: _hash,
    reviewerId: _reviewer,
    creator,
    reviewer,
    fromDate,
    toDate,
    createdAt,
    updatedAt,
    submittedAt,
    reviewedAt,
    ...fields
  } = row;
  void _key;
  void _hash;
  void _reviewer;
  return {
    ...fields,
    creatorName: creator.name,
    reviewerName: reviewer?.name || null,
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: toDate.toISOString().slice(0, 10),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    submittedAt: submittedAt?.toISOString() || null,
    reviewedAt: reviewedAt?.toISOString() || null,
  };
}
export async function hrAudit(
  tx: Prisma.TransactionClient,
  companyId: string,
  actorId: string,
  entity: string,
  entityId: string,
  action: string,
  changes: unknown,
) {
  await tx.auditLog.create({
    data: {
      companyId,
      actorId,
      entity,
      entityId,
      action,
      changes: JSON.parse(JSON.stringify(changes)) as Prisma.InputJsonValue,
    },
  });
}
