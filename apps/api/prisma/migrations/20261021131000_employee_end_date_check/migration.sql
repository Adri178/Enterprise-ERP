BEGIN;
-- SQL CHECK permits NULL unless it is explicitly rejected.
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_employment_dates_check";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_employment_dates_check" CHECK (
  (status = 'ACTIVE' AND "endDate" IS NULL)
  OR (status = 'INACTIVE' AND "endDate" IS NOT NULL AND "endDate" >= "startDate")
);
COMMIT;
