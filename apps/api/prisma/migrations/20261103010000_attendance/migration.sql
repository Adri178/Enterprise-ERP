BEGIN;
-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'PERMIT', 'LEAVE');

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "checkInMinutes" INTEGER,
    "checkOutMinutes" INTEGER,
    "description" TEXT NOT NULL DEFAULT '',
    "leaveRequestId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "editedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceRecord_companyId_date_status_idx" ON "AttendanceRecord"("companyId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_companyId_id_key" ON "AttendanceRecord"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_companyId_number_key" ON "AttendanceRecord"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_companyId_requestKey_key" ON "AttendanceRecord"("companyId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_companyId_employeeId_date_key" ON "AttendanceRecord"("companyId", "employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_companyId_id_employeeId_key" ON "LeaveRequest"("companyId", "id", "employeeId");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_companyId_employeeId_fkey" FOREIGN KEY ("companyId", "employeeId") REFERENCES "Employee"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_companyId_leaveRequestId_employeeId_fkey" FOREIGN KEY ("companyId", "leaveRequestId", "employeeId") REFERENCES "LeaveRequest"("companyId", "id", "employeeId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_editedBy_fkey" FOREIGN KEY ("editedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "Attendance_clock_valid" CHECK (
  (status = 'PRESENT' AND "checkInMinutes" IS NOT NULL AND "checkOutMinutes" IS NOT NULL
   AND "checkInMinutes" BETWEEN 0 AND 1439 AND "checkOutMinutes" BETWEEN 0 AND 1439 AND "checkOutMinutes" > "checkInMinutes")
  OR (status <> 'PRESENT' AND "checkInMinutes" IS NULL AND "checkOutMinutes" IS NULL)
);
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "Attendance_leave_link_valid" CHECK ((status = 'LEAVE') = ("leaveRequestId" IS NOT NULL));
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "Attendance_metadata_valid" CHECK (
  revision >= 0 AND "requestHash" ~ '^[a-f0-9]{64}$' AND char_length(description) <= 1000
  AND char_length("employeeCode") > 0 AND char_length("employeeName") > 0
  AND date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date
);

CREATE FUNCTION attendance_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id, NEW."companyId", NEW."employeeId", NEW.date, NEW.number, NEW."requestKey", NEW."requestHash", NEW."employeeCode", NEW."employeeName", NEW."branchName", NEW."departmentName", NEW."createdBy", NEW."createdAt")
     IS DISTINCT FROM ROW(OLD.id, OLD."companyId", OLD."employeeId", OLD.date, OLD.number, OLD."requestKey", OLD."requestHash", OLD."employeeCode", OLD."employeeName", OLD."branchName", OLD."departmentName", OLD."createdBy", OLD."createdAt") THEN
    RAISE EXCEPTION 'Attendance identity and original snapshots are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.revision <> OLD.revision + 1 OR NEW."updatedAt" <= OLD."updatedAt" THEN
    RAISE EXCEPTION 'Attendance correction requires a new revision and timestamp' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER attendance_identity_before_update BEFORE UPDATE ON "AttendanceRecord" FOR EACH ROW EXECUTE FUNCTION attendance_identity_guard();

CREATE FUNCTION attendance_record_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "AttendanceRecord"%ROWTYPE; e "Employee"%ROWTYPE; approved TEXT;
BEGIN
  SELECT * INTO a FROM "AttendanceRecord" WHERE id = NEW.id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO e FROM "Employee" WHERE "companyId" = a."companyId" AND id = a."employeeId" FOR UPDATE;
  IF NOT FOUND OR a.date < e."startDate" OR (e."endDate" IS NOT NULL AND a.date > e."endDate") THEN
    RAISE EXCEPTION 'Attendance date must remain within employment dates' USING ERRCODE = '23514';
  END IF;
  IF EXTRACT(ISODOW FROM a.date) BETWEEN 1 AND 5 THEN
    SELECT id INTO approved FROM "LeaveRequest" WHERE "companyId" = a."companyId" AND "employeeId" = a."employeeId" AND status = 'APPROVED' AND "fromDate" <= a.date AND "toDate" >= a.date ORDER BY id LIMIT 1;
  END IF;
  IF a.status = 'LEAVE' THEN
    IF approved IS NULL OR NOT EXISTS (SELECT 1 FROM "LeaveRequest" WHERE id = a."leaveRequestId" AND "companyId" = a."companyId" AND "employeeId" = a."employeeId" AND status = 'APPROVED' AND "fromDate" <= a.date AND "toDate" >= a.date) THEN
      RAISE EXCEPTION 'Attendance leave must reference approved leave on a working day' USING ERRCODE = '23514';
    END IF;
  ELSIF approved IS NOT NULL THEN
    RAISE EXCEPTION 'Attendance conflicts with approved leave' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER attendance_consistency_at_commit AFTER INSERT OR UPDATE ON "AttendanceRecord" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION attendance_record_consistency();

CREATE FUNCTION attendance_employee_dates() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "Employee"%ROWTYPE;
BEGIN
  SELECT * INTO e FROM "Employee" WHERE id = NEW.id AND "companyId" = NEW."companyId";
  IF EXISTS (SELECT 1 FROM "AttendanceRecord" WHERE "companyId" = e."companyId" AND "employeeId" = e.id AND (date < e."startDate" OR (e."endDate" IS NOT NULL AND date > e."endDate"))) THEN
    RAISE EXCEPTION 'Employment dates must retain Attendance history' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER attendance_employee_dates_at_commit AFTER UPDATE ON "Employee" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION attendance_employee_dates();

CREATE FUNCTION attendance_leave_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l "LeaveRequest"%ROWTYPE;
BEGIN
  SELECT * INTO l FROM "LeaveRequest" WHERE id = NEW.id AND "companyId" = NEW."companyId";
  IF NOT FOUND THEN RETURN NULL; END IF;
  PERFORM 1 FROM "Employee" WHERE "companyId" = l."companyId" AND id = l."employeeId" FOR UPDATE;
  IF l.status = 'APPROVED' AND EXISTS (SELECT 1 FROM "AttendanceRecord" WHERE "companyId" = l."companyId" AND "employeeId" = l."employeeId" AND date BETWEEN l."fromDate" AND l."toDate" AND EXTRACT(ISODOW FROM date) BETWEEN 1 AND 5 AND status <> 'LEAVE') THEN
    RAISE EXCEPTION 'Approved leave conflicts with Attendance' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM "AttendanceRecord" WHERE "companyId" = l."companyId" AND "leaveRequestId" = l.id AND (l.status <> 'APPROVED' OR date NOT BETWEEN l."fromDate" AND l."toDate" OR EXTRACT(ISODOW FROM date) NOT BETWEEN 1 AND 5)) THEN
    RAISE EXCEPTION 'Approved leave must retain linked Attendance history' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER attendance_leave_at_commit AFTER INSERT OR UPDATE ON "LeaveRequest" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION attendance_leave_consistency();
COMMIT;
