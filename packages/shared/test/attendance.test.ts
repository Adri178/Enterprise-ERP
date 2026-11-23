import { test } from "node:test";
import assert from "node:assert/strict";
import { attendanceClock, attendanceClockMinutes, attendanceCreateSchema, attendanceCorrectionSchema, attendanceQuerySchema, attendanceToday } from "../src/attendance";
const input = { requestKey: "710005de-6e49-4f92-96d8-73ca04f22413", employeeId: "employee", date: "2026-01-05", status: "PRESENT", checkIn: "08:00", checkOut: "17:00", description: "" };
test("Attendance validates real local dates, same-day clocks and nonworking status fields", () => {
  assert.equal(attendanceCreateSchema.parse(input).date, input.date);
  assert.equal(attendanceCreateSchema.parse({ ...input, requestKey: input.requestKey.toUpperCase() }).requestKey, input.requestKey);
  assert.match(attendanceToday(), /^\d{4}-\d{2}-\d{2}$/);
  for (const patch of [{ date: "2026-02-30" }, { date: "9999-12-31" }, { date: "0000-01-01" }, { checkIn: "24:00" }, { checkOut: "08:00" }, { checkOut: "07:59" }, { checkIn: "" }, { status: "PERMIT" }, { companyId: "other" }, { requestKey: "invalid" }, { employeeId: "" }]) assert.equal(attendanceCreateSchema.safeParse({ ...input, ...patch }).success, false);
  assert.ok(attendanceCreateSchema.safeParse({ ...input, status: "LEAVE", checkIn: "", checkOut: "" }).success);
  assert.equal(attendanceClockMinutes("08:15"), 495); assert.equal(attendanceClock(495), "08:15"); assert.equal(attendanceClock(null), "");
});
test("Attendance corrections require versions/reasons and cannot change record identity", () => {
  const correction = { status: "PRESENT", checkIn: "08:00", checkOut: "18:00", description: "", reason: "Koreksi jam pulang", expectedUpdatedAt: "2026-11-01T01:00:00.000Z" };
  assert.ok(attendanceCorrectionSchema.safeParse(correction).success);
  for (const patch of [{ expectedUpdatedAt: "" }, { reason: "x" }, { employeeId: "new" }, { date: "2026-01-01" }, { checkOut: "07:00" }]) assert.equal(attendanceCorrectionSchema.safeParse({ ...correction, ...patch }).success, false);
  for (const patch of [{ period: "2026-13" }, { period: "0000-01" }, { pageSize: 101 }, { sort: "companyId" }, { page: 0 }, { companyId: "foreign" }]) assert.equal(attendanceQuerySchema.safeParse(patch).success, false);
  assert.equal(attendanceQuerySchema.parse({}).period, attendanceToday().slice(0, 7));
});
