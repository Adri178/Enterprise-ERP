import { Prisma } from "@prisma/client";
// Prisma raw row locks expose PostgreSQL SQLSTATE instead of ORM error P2034.
export function isTransactionConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code)));
}
