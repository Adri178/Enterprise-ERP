# Attendance

In live API mode, `/attendance` uses PostgreSQL records linked to real Company-scoped Employees. Browser demo mode retains the separate, explicitly labeled prototype; demo records are never imported into operational HR automatically.

## Recording and corrections

- ADMIN/MANAGER can record and correct; VIEWER can read/export. Every write rechecks the active User, current membership/Role and active Company inside its transaction. Archived Companies remain readable and cannot be changed.
- Creation requires an active Employee with active Branch/Department from the selected Company. The date must fall within employment dates and cannot be later than the current date in Asia/Jakarta. Employment date edits cannot exclude existing Attendance history.
- There is one record per Company/Employee/date. Numbering uses `ATT-<company-code>-<year>-<sequence>`. A UUID request key and normalized-input hash make create retries idempotent; another payload/actor cannot reuse that key.
- **Hadir:** both HH:mm values are required, 00:00–23:59, with clock-out after clock-in on the same day. **Tidak Hadir**, **Izin** and **Cuti:** both clock values are empty. Duration is server-derived minutes between the clocks, without deductions or overtime calculations.
- Employee/date, original organization/name snapshots, document number and creation metadata remain fixed. Corrections can change status, clocks and description, require a reason of 5–500 characters and `expectedUpdatedAt`, and increment the revision with a monotonic timestamp. Concurrent/stale corrections conflict instead of overwriting each other. Historic records can be corrected after Employee deactivation, within the retained employment dates.
- Corrections and before/after audit snapshots commit atomically. If audit creation fails, the correction and revision roll back. The detail returns the latest 100 corrections and the total history count. There is no delete/void endpoint or correction-approval workflow in this milestone; mistakenly choosing a different Employee/date requires a future cancellation workflow.

## Leave integration

`Cuti` requires an **APPROVED** Leave Request for the same Company/Employee/date on Monday–Friday, following the existing Leave working-day policy. The service resolves and stores its scoped foreign key. Other Attendance statuses conflict with approved leave on those working days. Weekends inside a multi-day Leave interval are not automatically counted as Cuti.

Leave approval also rejects dates that already contain a non-Cuti Attendance record. It does not silently replace recorded work/absence. Existing approved Leave remains immutable; approved-leave reversal and retroactive replacement of a conflicting Attendance record remain pending. Pending Leave alone does not block recording actual Attendance.

Compound foreign keys, unique indexes, clock/link CHECKs, an identity/revision update guard and deferred cross-record database checks independently protect Company ownership, employment dates and approved-leave consistency. Employee/Leave service checks provide operator feedback before those database checks where possible. Serializable write transactions prevent concurrent write skew.

## REST contract

All routes require authentication and Company membership. They retain the original root `/api` prefix and use the same authentication as existing ERP endpoints.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/companies/:companyId/hr/attendance` | Filtered page and full-result summary |
| GET | `/api/companies/:companyId/hr/attendance/export` | All filtered entries, capped at 10,000 |
| GET | `/api/companies/:companyId/hr/attendance/:id` | Record and bounded correction history |
| POST | `/api/companies/:companyId/hr/attendance` | Record Attendance, HTTP 201 |
| PATCH | `/api/companies/:companyId/hr/attendance/:id` | Correct mutable fields, HTTP 200 |

List/export query: `period=YYYY-MM` (defaults to current Jakarta month), `q`, `status=ALL|PRESENT|ABSENT|PERMIT|LEAVE`, optional `employeeId`, `sort=date|employeeCode|employeeName|status|createdAt`, `direction=asc|desc`, `page` and `pageSize` (maximum 100). Company context comes from the authorized route, not a request-body override. Unknown fields are rejected. Exports ignore pagination but retain the other filters and execute in one database snapshot; selections above 10,000 fail before rows are read.

Creation fields: `requestKey`, `employeeId`, `date`, `status`, `checkIn`, `checkOut`, `description`.

Correction fields: `expectedUpdatedAt`, `reason`, `status`, `checkIn`, `checkOut`, `description`. Extra identity fields are rejected.

Responses expose formatted clock strings, immutable Employee/organization snapshots, status, derived `durationMinutes`, revision, creator/editor names and ISO timestamps. Request hashes/keys and password/session information are excluded. Detail includes the linked `leaveRequestId` when applicable. Typical errors are 400 validation, 401 authentication, 403 Company/Role denial, 404 a record outside the selected Company or not found, and 409 duplicate/version/business conflicts. Unexpected database/audit failures roll back and return a generic server error.

## Web behavior and development data

The desktop page supports month, Employee, status and text filters, sortable date, server pagination, real Employee selection, record/detail/correction forms and CSV export of all filtered entries. Summary values come from the database over the entire filter. Company switching suppresses old rows, closes dialogs, clears URL-selected Employees from the prior Company and cancels an in-flight CSV. The exported duration column is explicitly in minutes.

`npm run db:seed:attendance` adds up to four development entries on 2 November 2026 for the existing `EMP-001`/`EMP-002` profiles in Alpha/Beta. It skips inactive/ineligible profiles, approved leave and existing Employee/date records, without overwriting them or elevating Gamma. It refuses production and future fixture dates. Rerunning the seed preserves Attendance, Employee profiles, audit and sequences.

`npm run test:attendance` checks the real local API/database; `npm run test:ui:live -- .local/test-build/web/test/attendance-live.integration.js` checks real forms and Company/export behavior through the Next.js proxy. Fixtures own disposable Companies and clean up only their rows. See [verification log](verification.md).

Shift scheduling, overnight shifts, calendar view, geolocation/biometrics, device punches, meal breaks, overtime, paid hours/payroll, public-holiday calendars, self-service and mobile screens are outside this milestone.
