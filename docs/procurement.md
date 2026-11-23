# Procurement workflow

Use live mode (`NEXT_PUBLIC_DATA_MODE=live`) with the migrated NestJS/PostgreSQL database. Sign in at `/login`, select a company, then open **Procurement** or **Purchase Request**. The development seed contains fictional transactions; they exercise the real workflow and are stored separately from legacy document snapshots.

## Processing a purchase

1. Choose **Buat Purchase Request**. Select an active Supplier, Warehouse, and stock-tracked Items from the active company. Enter integer quantities, unit prices, date, and optional description. Up to 50 unique Items and two decimal places in prices are supported.
2. Save the draft, review its lines, then choose **Ajukan Approval**. An ADMIN or MANAGER can approve or reject it. Both Roles may approve their own Requests in this initial implementation.
3. On an approved Request, choose **Buat Purchase Order**. Confirm the date, review the copied document, and choose **Bukukan Dokumen**.

   Alternatively, choose **Buat RFQ** to compare multiple Suppliers. The specific award requires another User's Approval before generating an Order. An active RFQ blocks direct conversion of its Request; the original Request/Supplier estimate remains intact. See [operational RFQ](rfq.md) for comparison, cancellation and the REST contract.
4. Create and post the **Purchase Receipt** from that Order. Posting receives every line into the selected Warehouse. This atomically creates Stock ledger entries, updates balances, changes the document status, and writes an audit event.
5. Create and post the **Purchase Invoice** from the Receipt. This adds its full value to outstanding Purchase Invoices.
6. Create and post **Payment** from the Invoice. This settles the full Invoice. Accounting → Payments and Accounts Payable expose these records. When Company [automatic Accounting](automatic-accounting.md) is activated, Receipt/Invoice/Payment also generate their balanced Inventory/GRNI/AP/Cash Journals in the same transaction. Disabled Companies retain operational-only posting.

Each dialog links to its source and successors. Posting is confirmed before execution. Posted documents cannot be edited, cancelled, or deleted through the API. Draft documents can be cancelled; a cancelled successor can be replaced. Rejected Requests cannot advance. Dates cannot precede their source document.

## Data integrity and architecture

| Concern | Implementation |
| --- | --- |
| Company isolation | JWT User lookup, membership/Role guard, server-owned company context, compound company/reference foreign keys |
| Numbering | `DocumentSequence`, atomic company/prefix/year increment inside the creation transaction |
| Creation retries | Client-generated UUID, company/request-key uniqueness, normalized request SHA-256 hash; changed retry payload returns 409 |
| Workflow | Shared schemas and allowed actions; service independently validates status and source stage |
| Concurrency | Required `expectedUpdatedAt`, Serializable writes, unique active successor index, unique receipt/item ledger row |
| Receipt posting | Ledger + balance increment + status + audit in one transaction; no public direct-balance write endpoint |
| Precision | Prisma Decimal calculations and Decimal(20,2) storage; maximum document amount 10¹² |
| History | Snapshot names/unit/prices on document lines, references protected against deletion, audit actor/status transitions |
| Read models | Paginated server queries; company aggregates and six-month trends exclude legacy snapshots |

`PurchaseDocument` represents typed stages with a self-referencing source. `PurchaseLine` stores immutable source snapshots. `StockLedger` records posted receipts, Transfers, and Adjustments; `StockBalance` is the current projection for each company/Item/Warehouse. Inventory operations use `StockOperation` and share the same atomic posting function with Receipt posting. See the [Inventory guide](inventory.md). Receipt posting also rejects a date earlier than the latest affected Stock movement.

## REST API

All paths below follow `/api/companies/:companyId`. Reads require company membership. Mutations require ADMIN or MANAGER and an active company. The shared API limit is 120 requests/minute; login is limited to 8/minute.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/procurement` | Paginated documents; `kind`, `status`, `q`, `page`, `pageSize` (1–100), `direction` |
| GET | `/procurement/:id` | Lines, source number, successors |
| GET | `/procurement/summary` | Posted purchases/Payments, outstanding, pending Requests, Inventory totals |
| GET | `/procurement/analytics` | Last six calendar months of posted Purchase Invoices/Payments |
| POST | `/procurement/requests` | Create a line-item Request |
| POST | `/procurement/from-source` | Convert to the next stage |
| POST | `/procurement/:id/actions` | `submit`, `approve`, `reject`, `post`, `cancel` |
| GET | `/stock/balances` | Current balances; `q`, `warehouseId`, `itemId`, `page`, `pageSize` |
| GET | `/stock/ledger` | Receipt/Transfer/Adjustment movements with source links and the same filters |

```json
{
  "requestKey": "d36985a0-f305-451a-8437-3c82036d21cc",
  "date": "2026-10-21",
  "supplierId": "same-company-supplier-id",
  "warehouseId": "same-company-warehouse-id",
  "description": "Kebutuhan operasional",
  "lines": [{ "itemId": "same-company-item-id", "quantity": 3, "unitPrice": 1000.25 }]
}
```

Creation returns the saved document. Conversion accepts `{ requestKey, sourceId, kind, date, description }`. Actions accept `{ action, expectedUpdatedAt }`. Valid `kind` values are `PURCHASE_REQUEST`, `PURCHASE_ORDER`, `PURCHASE_RECEIPT`, `PURCHASE_INVOICE`, `PAYMENT`. Errors return a JSON `message`: 400 validation, 401 session, 403 access, 404 scoped record missing, 409 conflict/stale version, 429 throttling. After a conflict, reload the document and review its current state before retrying.

## Boundaries

Partial processing, fractional quantities, tax, discounts, freight, service Items, returns, reversals, draft editing, Payment allocation across multiple Invoices, due-date ageing and configurable Approval rules remain pending. RFQ now provides operational comparison and independent award Approval, with its own audit detail. Manual and opt-in automatic double-entry Accounting are implemented with their documented limits. Other Procurement document-chain history is visible; a general Procurement audit-log UI is not yet available. Stock balances are current projections; historical valuation and inventory close remain pending. Sales is operational through its separate [workflow](sales.md).

## Development verification

Run `npm run verify`, `npm run test:procurement`, and `npm run test:ui:live`. Integration checks require the running API/database and, for the UI checks, Next.js on port 3000. They use disposable company-owned data and clean up their own records. `npm run db:seed:procurement` creates only missing development fixture chains; it never advances existing documents. If the initial seed is interrupted, a partially created fixture chain is deliberately preserved for inspection rather than overwritten.
