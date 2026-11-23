import "reflect-metadata";
import { config } from "dotenv";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { EmployeesService } from "../apps/api/dist/human-resources/employees.service.js";
import { LeavesService } from "../apps/api/dist/human-resources/leaves.service.js";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("Development seed only");
if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 12)
  throw new Error("Set DEMO_PASSWORD for development");
const prisma = new PrismaClient(),
  employees = new EmployeesService(prisma),
  leaves = new LeavesService(prisma);
try {
  const actor = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@enterprise.local" },
  });
  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer@enterprise.local" },
    create: {
      email: "reviewer@enterprise.local",
      name: "Rani Prameswari",
      passwordHash: await hash(process.env.DEMO_PASSWORD, 12),
    },
    update: {},
  });
  await prisma.membership.upsert({
    where: { userId_companyId: { userId: reviewer.id, companyId: "alpha" } },
    create: { userId: reviewer.id, companyId: "alpha", role: "MANAGER" },
    update: {},
  });
  for (const companyId of ["alpha", "beta"]) {
    const member = await prisma.membership.findUnique({
      where: { userId_companyId: { userId: actor.id, companyId } },
      include: { company: true },
    });
    if (
      !actor.active ||
      !member ||
      !["ADMIN", "MANAGER"].includes(member.role) ||
      member.company.status !== "ACTIVE"
    )
      continue;
    const department = await prisma.department.findFirst({
      where: {
        companyId,
        branchId: { not: null },
        record: { status: "ACTIVE" },
        branch: { record: { status: "ACTIVE" } },
      },
      orderBy: { id: "asc" },
    });
    if (!department) continue;
    let first;
    for (const [index, name, jobTitle] of [
      [
        1,
        companyId === "alpha" ? "Nadia Kusuma" : "Bima Pratama",
        "Operations Specialist",
      ],
      [
        2,
        companyId === "alpha" ? "Arif Wicaksono" : "Sinta Larasati",
        "Warehouse Coordinator",
      ],
    ]) {
      const code = `EMP-${String(index).padStart(3, "0")}`;
      let employee = await prisma.employee.findUnique({
        where: { companyId_code: { companyId, code } },
      });
      if (!employee)
        employee = await employees.save(companyId, actor.id, {
          code,
          name,
          jobTitle,
          email: `${companyId}.employee${index}@example.local`,
          phone: "",
          branchId: department.branchId,
          departmentId: department.id,
          employmentType: "PERMANENT",
          startDate: "2025-01-06",
          endDate: "",
          status: "ACTIVE",
        });
      if (index === 1) first = employee;
    }
    const requestKey =
      companyId === "alpha"
        ? "aa202626-1021-4ee0-b234-000000000001"
        : "bb202626-1021-4ee0-b234-000000000001";
    const eligible =
      first &&
      (await prisma.employee.findFirst({
        where: {
          companyId,
          id: first.id,
          status: "ACTIVE",
          startDate: { lte: new Date("2026-11-03") },
          endDate: null,
          branch: { record: { status: "ACTIVE" } },
          department: { record: { status: "ACTIVE" } },
        },
      }));
    const overlapping =
      first &&
      (await prisma.leaveRequest.count({
        where: {
          companyId,
          employeeId: first.id,
          status: { in: ["PENDING", "APPROVED"] },
          fromDate: { lte: new Date("2026-11-04") },
          toDate: { gte: new Date("2026-11-03") },
        },
      }));
    if (
      eligible &&
      !overlapping &&
      !(await prisma.leaveRequest.findUnique({
        where: { companyId_requestKey: { companyId, requestKey } },
      }))
    ) {
      const row = await leaves.create(companyId, actor.id, {
        requestKey,
        employeeId: first.id,
        type: "ANNUAL",
        fromDate: "2026-11-03",
        toDate: "2026-11-04",
        reason: "Fixture pengembangan: keperluan keluarga.",
      });
      if (companyId === "alpha")
        await leaves.action(companyId, actor.id, row.id, {
          action: "submit",
          expectedUpdatedAt: row.updatedAt,
        });
    }
  }
  console.log(
    "Development HR fixtures ready; existing Employees, requests, reviewer password and Roles preserved.",
  );
} finally {
  await prisma.$disconnect();
}
