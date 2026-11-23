import "reflect-metadata";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { attendanceToday } from "@erp/shared";
import { AttendanceService } from "../apps/api/dist/human-resources/attendance.service.js";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production") throw new Error("Development seed only");
const prisma = new PrismaClient(), service = new AttendanceService(prisma), date = "2026-11-02";
let created = 0;
try {
  if (date > attendanceToday()) throw new Error("Attendance fixture date is in the future");
  const actor = await prisma.user.findUniqueOrThrow({ where: { email: "admin@enterprise.local" } });
  for (const [companyId, prefix] of [["alpha", "a7"], ["beta", "b7"]]) {
    const member = await prisma.membership.findUnique({ where: { userId_companyId: { userId: actor.id, companyId } }, include: { company: true } });
    if (!member?.active || !actor.active || actor.mustChangePassword || !["ADMIN", "MANAGER"].includes(member.role) || member.company.status !== "ACTIVE") continue;
    for (let index = 1; index <= 2; index++) {
      const employee = await prisma.employee.findFirst({ where: { companyId, code: `EMP-${String(index).padStart(3, "0")}`, status: "ACTIVE", startDate: { lte: new Date(date) }, OR: [{ endDate: null }, { endDate: { gte: new Date(date) } }], branch: { record: { status: "ACTIVE" } }, department: { record: { status: "ACTIVE" } } } });
      if (!employee || await prisma.attendanceRecord.findUnique({ where: { companyId_employeeId_date: { companyId, employeeId: employee.id, date: new Date(date) } } })) continue;
      const approved = await prisma.leaveRequest.count({ where: { companyId, employeeId: employee.id, status: "APPROVED", fromDate: { lte: new Date(date) }, toDate: { gte: new Date(date) } } });
      if (approved) continue;
      await service.create(companyId, actor.id, { requestKey: `${prefix}202626-1103-4ee0-b234-00000000000${index}`, employeeId: employee.id, date, status: index === 1 ? "PRESENT" : "PERMIT", checkIn: index === 1 ? "08:00" : "", checkOut: index === 1 ? "17:00" : "", description: "Contoh Attendance development" }); created++;
    }
  }
  console.log(`Attendance seed complete: ${created} records created; existing records and employee profiles preserved.`);
} finally { await prisma.$disconnect(); }
