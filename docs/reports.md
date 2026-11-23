# Operational Reports & Analytics

Open `/reports` in live API mode. Select **Sales Invoice** or **Purchase Invoice**, set the Invoice date period, optional number/party search and settlement status, then select **Terapkan**. Shortcuts select the current month/year through today in Asia/Jakarta, or the complete previous month. Changing the Company resets the report context.

## What the numbers mean

- Only **POSTED** Sales/Purchase Invoices whose document dates fall within the inclusive period are included. Draft/cancelled Invoices, Orders, Quotations, Stock documents, and legacy Phase 1 snapshots are excluded.
- **Nilai Invoice** is the sum of matching Invoice amounts. **Nilai Dilunasi** includes posted, linked full Payments dated on or before the report's end date. **Sisa Belum Lunas** is the difference. A February Payment does not settle an Invoice in a report ending in January.
- The report describes the selected **Invoice cohort**. It is not a cash-flow report: a Payment for an Invoice outside the period is excluded. It is not the Company's complete receivable/payable balance either; use the relevant operational pages for all-period totals.
- Search and settlement filters apply to **all** metrics, monthly chart values, top five parties, table rows, and exports. Search matches Invoice numbers and stored Customer/Supplier names literally and case-insensitively; `%` and `_` are ordinary characters.
- The monthly chart groups Invoice values by document month and fills empty months with zero. Party rankings group by the stable Customer/Supplier ID, use the name from that party's newest matching Invoice, and use a stable ID tie-breaker.
- Currency follows the Company and the document snapshots. There is no cross-company consolidation or currency conversion.

Settlement is based on currently posted documents and their business dates, not on immutable historical snapshots or the time an operator posted them. A later posting with an earlier document date can change a previous period's result. The UI states this explicitly. Tax, returns/reversals, partial settlement, due dates/ageing, General Ledger statements, and historical Inventory valuation remain pending.

## API

All routes require JWT authentication and membership in the requested Company, including export. ADMIN, MANAGER, and authorized VIEWER Roles can read. Archived Companies retain read access. These endpoints do not change workflow records, Stock balances, or audit logs.

| Method | Path under `/api/companies/:companyId` | Result                                                                |
| ------ | -------------------------------------- | --------------------------------------------------------------------- |
| GET    | `/reports/invoices`                    | Summary, zero-filled monthly series, top five parties, paginated rows |
| GET    | `/reports/invoices/export`             | Complete filtered row set and summary, capped at 10,000 Invoices      |

Query parameters:

| Parameter          | Values                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `domain`           | `sales` (default), `procurement`                                                         |
| `from`, `to`       | Required ISO dates; inclusive period of at most 366 days; year 0001–9999                 |
| `q`                | Optional literal number/party search, maximum 120 characters                             |
| `settlement`       | `ALL` (default), `PAID`, `UNPAID`, assessed at `to`                                      |
| `sort`             | `date` (default), `number`, `partyName`, `amount`, `outstanding`                         |
| `direction`        | `desc` (default), `asc`; stable Invoice ID tie-breaker                                   |
| `page`, `pageSize` | List only; page starts at 1; size 1–100, default 10; oversized page clamps to final page |

Example:

```http
GET /api/companies/alpha/reports/invoices?domain=sales&from=2026-10-01&to=2026-10-31&settlement=UNPAID&sort=amount&direction=desc
```

Responses include `domain`, `period`, `generatedAt`, `summary` (`count`, `amount`, `settled`, `outstanding`) and `data`. List responses also include `monthly`, `parties`, and `meta`. Rows contain Invoice identity, date, party identity/name, currency, amount, settlement, outstanding value, and the counted Payment's number/date. Internal request hashes, idempotency keys, actor IDs, and document lines are not returned.

## Consistency and export

Prisma parameterized SQL scopes both Invoice and Payment sides to the requested Company. Table/column/sort identifiers come only from fixed code fragments. Each response uses a PostgreSQL **Repeatable Read** transaction, so its summary and rows see the same database snapshot. SQL performs filtering, aggregation, sorting, and pagination; the API does not fetch the entire register to calculate Dashboard-style totals. This feature needs no new migration or seed changes.

Export counts and fetches the entire matching set inside one transaction. More than 10,000 results returns HTTP 400 with a request to narrow the filters; it never silently truncates. The frontend generates a UTF-8 CSV containing Company, period, applied filters, generation time, totals, and all matching rows. Existing CSV escaping protects spreadsheet formula prefixes. Company/domain/filter changes abort a pending download; unmounting also aborts it. A report viewed earlier and a later export are separate snapshots and may differ if data changed between requests.

Browser-local demo mode retains the clearly labelled snapshot register. It does not pretend to provide operational report calculations. Stock Overview remains a separate link showing **current** balances, without presenting them as historical balances at the selected report date.

## Verification

```sh
npm run verify
npm run test:reports
npm run test:ui:live
node scripts/verify-routes.mjs
```

The API report suite creates a disposable Company and uses the existing Sales/Procurement/Stock services to build real workflow documents. It checks period boundaries, later Payments, drafts/cancellations, literal search, ordering/pagination, zero-filled months, complete export, per-company authorization and read-only behavior. The live React DOM test covers filters, validation, sorting/pagination, CSV contents, Invoice details, and changing Company during a delayed export. Fixtures are cleaned up only after verifying their unique Company code. jsdom verifies behavior; authenticated desktop/mobile browser layout inspection remains separate and pending.
