BEGIN;
-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'CONTRACT', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "jobTitle" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "branchId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'DRAFT',
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Employee_companyId_status_name_idx" ON "Employee"("companyId", "status", "name");

-- CreateIndex
CREATE INDEX "Employee_companyId_branchId_departmentId_idx" ON "Employee"("companyId", "branchId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_id_key" ON "Employee"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_code_key" ON "Employee"("companyId", "code");

-- CreateIndex
CREATE INDEX "LeaveRequest_companyId_employeeId_status_fromDate_toDate_idx" ON "LeaveRequest"("companyId", "employeeId", "status", "fromDate", "toDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_companyId_status_fromDate_idx" ON "LeaveRequest"("companyId", "status", "fromDate");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_companyId_id_key" ON "LeaveRequest"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_companyId_number_key" ON "LeaveRequest"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_companyId_requestKey_key" ON "LeaveRequest"("companyId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Department_companyId_id_branchId_key" ON "Department"("companyId", "id", "branchId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_branchId_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "Branch"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_departmentId_branchId_fkey" FOREIGN KEY ("companyId", "departmentId", "branchId") REFERENCES "Department"("companyId", "id", "branchId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_companyId_employeeId_fkey" FOREIGN KEY ("companyId", "employeeId") REFERENCES "Employee"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_employment_dates_check" CHECK (
  (status = 'ACTIVE' AND "endDate" IS NULL) OR (status = 'INACTIVE' AND "endDate" >= "startDate")
);
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_code_check" CHECK (code = upper(code) AND code ~ '^[A-Z0-9-]{2,30}$');
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_dates_days_check" CHECK (
  "toDate" - "fromDate" BETWEEN 0 AND 365 AND days BETWEEN 1 AND 262
);
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_reason_check" CHECK (char_length(reason) BETWEEN 5 AND 1000 AND char_length(note) <= 500);
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_review_check" CHECK (
  (status IN ('DRAFT', 'CANCELLED') AND "reviewerId" IS NULL AND "reviewedAt" IS NULL AND (status <> 'DRAFT' OR "submittedAt" IS NULL))
  OR (status = 'PENDING' AND "submittedAt" IS NOT NULL AND "reviewerId" IS NULL AND "reviewedAt" IS NULL)
  OR (status IN ('APPROVED', 'REJECTED') AND "submittedAt" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "reviewerId" IS NOT NULL
      AND "reviewerId" <> "createdBy" AND (status <> 'REJECTED' OR char_length(note) >= 5))
);
COMMIT;
