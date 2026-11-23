# Sales workflow

Use live mode, sign in, and select a company before opening Sales & CRM. Operational pages cover Quotation, Sales Order, Delivery Note, Sales Invoice, and Payment. Leads/CRM activities remain previews.

## Processing a sale

1. Choose **Buat Quotation**, then select an active Customer, Warehouse, and stock-tracked Items from the active company. Enter positive integer quantities and selling prices with up to two decimal places. Save and review the draft, then choose **Bukukan Dokumen**.
2. Create a Sales Order from the posted Quotation. Confirm its date and post it. Neither Quotation nor Sales Order reserves or changes Stock.
3. Create a Delivery Note from the posted Order. Posting rechecks active Items/Warehouse, current balances, Stock date ordering, and document version. It removes every line from Stock at the source Warehouse's moving-average book cost.
4. Create a Sales Invoice from the posted Delivery. Its total retains the source selling prices, independently of Stock book cost. Posting adds the full amount to Customer receivables and checks Credit Limit.
5. Create Payment from the posted Invoice. Posting settles that entire Invoice. With Company [automatic Accounting](automatic-accounting.md) activated, Delivery records actual COGS, Invoice records receivable/revenue, and Payment records Cash/Bank against receivable in the same operational transactions. Disabled Companies retain operational-only posting.

Every stage copies all lines from its source. Only one active successor of the next stage may exist; a cancelled draft can be replaced. Dates cannot precede source dates, and Delivery cannot precede the latest Stock movement on affected Items/Warehouses. Posted documents are immutable through the API. Incorrect drafts can be cancelled and recreated; returns/reversals and draft editing are not implemented.

## Credit Limit

Customer Credit Limit uses the company currency. Zero means unlimited. When posting a Sales Invoice, the service calculates posted Sales Invoices minus posted received Payments for that Customer and adds the proposed Invoice. The result must not exceed a positive Credit Limit. Serializable transactions protect this check against concurrent Invoice posting.

The check occurs at Invoice posting, after Delivery. It is not an Order/shipping hold or Stock reservation system. If credit is insufficient, record Payment against existing Invoices or update the Customer limit through authorized Master Data editing, then review/retry the draft Invoice. Existing posted Invoices are preserved if a limit is later lowered. Payment may settle an inactive Customer's historical Invoice; new non-Payment documents require an active Customer.

## Inventory and data integrity

- Delivery writes signed negative ledger entries, decrements balances, records line book costs, changes status, and creates audit events in one Serializable transaction. Any failing line rolls back the entire Delivery.
- Outgoing costs use the same moving-average function as Transfer and negative Adjustment. Selling prices never determine Stock book value. Full depletion allocates any rounding remainder, leaving exactly zero quantity/value.
- Composite foreign keys enforce same-company Customer, Item, Warehouse, source document, and ledger references. API guards check authenticated User membership and per-company Role. ADMIN/MANAGER prepare/post/cancel drafts; VIEWER reads only.
- UUID request keys and normalized-body hashes protect creation retries. Required versions, active-successor uniqueness, and Delivery/item ledger uniqueness prevent duplicate processing. Stock withdrawals and Customer Credit Limit checks are serialized.
- Referenced Customers/Items/Warehouses cannot be deleted. Used Item units/Stock tracking and company currency are protected against changes that would invalidate history.
- All balances and metrics exclude legacy document snapshots. The operational Dashboard combines real Sales and Procurement Invoice values and Stock balances. It does not claim accounting profit, tax, or bank reconciliation.

## UI and Payments

Sales and Procurement share the trade form, document inspector, and list components. Lists support Customer/number search, status/type filters, date sorting, server pagination, loading/empty/error feedback, and source/successor links. Company switches hide obsolete resource results immediately.

Accounting → **Accounts Receivable** shows Sales Invoice settlement status. Accounting → **Payments** switches between Payment Masuk (Sales) and Payment Keluar (Procurement). Sales & CRM → Payments also opens received Payments directly. Stock Movement identifies Delivery Notes and opens their Sales details. Global search includes Sales documents.

## REST API

All paths follow `/api/companies/:companyId`. Reads require company membership; mutations require active company ADMIN/MANAGER.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/sales` | Paginated list; `kind`, `status`, `q`, `page`, `pageSize` (1–100), `direction` |
| GET | `/sales/:id` | Lines, source number, successors, and Delivery line Stock costs |
| GET | `/sales/summary` | Posted Sales, received Payments, outstanding receivables, Orders, delivered book value |
| GET | `/sales/analytics` | Six calendar months of posted Sales Invoice/Payment values |
| POST | `/sales/quotations` | Create a Quotation draft |
| POST | `/sales/from-source` | Create the next stage from a posted source |
| POST | `/sales/:id/actions` | `{ action: "post" or "cancel", expectedUpdatedAt }` |

```json
{
  "requestKey": "5a1e4567-1234-4678-9234-123456789012",
  "date": "2026-10-21",
  "customerId": "same-company-customer-id",
  "warehouseId": "same-company-warehouse-id",
  "description": "Penawaran kebutuhan operasional",
  "lines": [{ "itemId": "same-company-item-id", "quantity": 2, "unitPrice": 1000.25 }]
}
```

Conversion accepts `{ requestKey, sourceId, kind, date, description }`. `kind` is `SALES_ORDER`, `DELIVERY_NOTE`, `SALES_INVOICE`, or `PAYMENT`; Quotation is created only through its initial endpoint. Limits match Procurement: 50 unique Items, quantities 1–1,000,000, and total amount up to 10¹². JSON errors use 400 validation, 401 session, 403 access, 404 scoped missing, 409 workflow/version/balance/credit conflicts, and 429 throttling. Reload and review after conflicts.

## Development data and checks

The normal `npm run db:seed` also runs the Sales fixture seed. `npm run db:seed:sales` can run it separately after Procurement fixtures exist. It creates an unpaid Alpha Invoice and a paid Beta Invoice through the business service, using eligible existing Stock and Customer credit. It skips unavailable/archived companies and insufficient inputs. Existing fixture chains are never advanced or overwritten on reseeding; interrupted chains are preserved for inspection. Repeated seed execution was fingerprint-checked to leave documents and Stock unchanged.

Run `npm run verify`, `npm run test:sales`, and `npm run test:ui:live`. API tests cover multi-line rollback, duplicate and concurrent deliveries/Payments, Customer Credit Limit conflicts including concurrent Invoices, source replacement, FK/RBAC isolation, outstanding settlement, and ledger reconciliation. Live React DOM tests complete the full UI chain and switch Payment directions using real JWT/API/PostgreSQL. They do not verify browser layout; authenticated desktop/mobile visual QA remains pending.

Partial fulfillment/settlement, tax, discounts, freight, due-date ageing, reservations, returns/reversals, service Items, currencies/FX conversion, configurable Sales Approvals, CRM Leads/opportunities/activities, bank/cash and double-entry Accounting remain pending.
