# Inventory operations

Stock Transfer and Stock Adjustment are operational in live API mode. Use the header's company switcher, then open the corresponding Inventory submenu. Existing development receipts supply example balances in Alpha and Beta. The browser-local demo does not simulate posting.

## Stock Transfer

1. Choose **Buat Stock Transfer** and select active source and destination Warehouses in the same company.
2. Select stock-tracked Items and positive integer quantities. The form shows the selected Item's current source balance. Enter a reason and date, then save the draft.
3. Review the draft and choose **Bukukan Dokumen**. Confirm the action. The service rechecks current balances, active records, company membership, date, and document version.
4. Each line creates a negative source ledger entry and a matching positive destination entry. The transaction preserves total company quantity and book value. Open **Stock Movement** to inspect either side and its source document.

There is no in-transit state: posting moves both sides atomically. A Transfer never crosses company boundaries. ADMIN and MANAGER may prepare, post, and cancel drafts; VIEWER has read access only.

## Stock Adjustment

Choose **Buat Stock Adjustment**, select a Warehouse and Items, and enter signed quantity changes. A positive quantity adds Stock and requires a positive unit price with up to two decimal places. A negative quantity removes Stock at the current moving average; enter no manual price. Quantities cannot be zero. A reason of at least five characters is required.

These quantities are **deltas**, not replacement balances. For example, a current balance of 10 with `-2` becomes 8. Saving a draft has no balance effect. ADMIN/MANAGER may prepare or cancel the draft; **only ADMIN can post an Adjustment**. The API checks this policy independently of UI controls.

Posted documents cannot be edited, cancelled, or deleted through the API. Correct errors with a separately reviewed Adjustment; no automatic reversal workflow exists yet.

## Valuation and dates

For outgoing quantity `q`, source quantity `Q`, and book value `V`, the allocated value is `round(V × q / Q, 2)`. If `q = Q`, the entire remaining value is allocated so an empty balance has exactly zero value. Unit costs are stored/displayed up to six decimals; ledger and balance values retain two decimals. Transfers add exactly the same allocated value to the destination. Addition Adjustments use the supplied unit price.

For example, 3 units at 10.01 plus 1 unit at 0.02 have value 30.05 and average 7.5125. Transferring 1 unit moves value 7.51; moving all remaining 3 units moves 22.54. The company still holds total value 30.05.

Valuation follows posting order, not a backdated recalculation engine. An operation or Receipt cannot be posted with a date earlier than the latest ledger date for an affected Item/Warehouse. Same-date operations are valued in commit order. No historical inventory-close or financial-period system is implied.

## Integrity

- Serializable writes include ledger rows, balance updates, line valuations, status transitions, and audit records. Any failing line rolls back the entire operation.
- Backend balance checks and database constraints prohibit negative quantity/value and nonzero value on an empty balance. Concurrent withdrawals conflict rather than overdrawing.
- Every ledger row references exactly one Purchase Receipt, Inventory operation, Sales Delivery or Manufacturing Work Order, using same-company composite foreign keys. Transfer sides are unique per operation/Item/Warehouse; production rows are unique per Work Order/Item.
- UUID request keys and request hashes make creation retryable; changed payloads with the same key are rejected. Posting requires `expectedUpdatedAt`; repeated/concurrent posting cannot duplicate ledger entries.
- Referenced Items/Warehouses cannot be deleted. Item units and Stock tracking are locked after use in Inventory or Procurement. Company currency is locked by any Inventory document, including drafts.
- No endpoint directly edits balances. Every implemented mutation uses the shared Stock posting function.

## REST API

All endpoints follow `/api/companies/:companyId`. Membership is required for reads. Mutations require an active company and ADMIN/MANAGER, with the additional ADMIN requirement for Adjustment posting.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/stock/operations` | Paginated list; `kind`, `status`, `q`, `page`, `pageSize` (1–100), `direction` |
| GET | `/stock/operations/:id` | Header and line snapshots/valuations |
| POST | `/stock/operations` | Create a draft; request body below |
| POST | `/stock/operations/:id/actions` | `{ action: "post" or "cancel", expectedUpdatedAt }` |
| GET | `/stock/balances` | Current projections; `q`, `warehouseId`, `itemId`, `page`, `pageSize` |
| GET | `/stock/ledger` | Signed movements and source links; same filters |

```json
{
  "requestKey": "82ad9934-595d-4a74-bba1-44f2ea2732d1",
  "kind": "TRANSFER",
  "date": "2026-10-21",
  "warehouseId": "same-company-source-id",
  "targetWarehouseId": "same-company-target-id",
  "description": "Pemindahan ke Warehouse cabang",
  "lines": [{ "itemId": "same-company-item-id", "quantity": 2, "unitPrice": 0 }]
}
```

For Adjustment, use `kind: "ADJUSTMENT"`, empty `targetWarehouseId`, signed nonzero quantities, and positive prices only for additions. Transfer/outgoing line prices must be zero in creation requests because costs are computed when posting. Each operation supports 50 unique Items, absolute line quantities up to 1,000,000, and total absolute posting value up to 10¹² in the company currency. Current balances are bounded to 2 billion units and 90 trillion value per Item/Warehouse.

Ledger responses retain `documentId`/`documentNumber` as the public source link and use `documentKind` (`PURCHASE_RECEIPT`, `TRANSFER`, `ADJUSTMENT`, `DELIVERY_NOTE`, `WORK_ORDER`); the public ID identifies the corresponding source. Database `documentId` is reserved for Receipt references, `operationId` identifies Inventory operations, `salesDocumentId` identifies Delivery and `workOrderId` identifies production. All sources open their actual detail dialogs from Stock Movement.

Errors use JSON `message`: 400 invalid input/references, 401 session, 403 permissions, 404 scoped document missing, 409 stale version/insufficient Stock/date/conflict, and 429 throttling. Reload after a conflict, review the current document and balances, then retry with the fresh version.

## Verification and remaining scope

Run `npm run verify`, `npm run test:inventory`, `npm run test:procurement`, and `npm run test:ui:live` against the running development services. API checks use a disposable company and clean up only its records. Migration fingerprint checks confirmed the two original receipt ledger rows and balances retained their IDs and values.

Sales Delivery depletes Stock through the same posting/valuation function; see the [Sales guide](sales.md). Company [automatic Accounting](automatic-accounting.md) now links Receipt, Delivery and Adjustment to generated Journals atomically; value-neutral Transfer/production retain source records without empty Journals. Reservations, fractional quantities, lots/serials, multi-stage/in-transit Transfers, stocktaking sessions, FIFO/batch costing, landed costs, period closing, historical valuation reports and draft editing remain pending. The feature does not claim advanced warehouse/accounting completion. Real-browser authenticated/mobile visual QA remains separate from jsdom form/database checks.

Manufacturing completion now uses the same atomic movement/valuation function to consume all materials and receive output at conserved total material value. The ninth migration adds scoped Work Order references and deferred checks tying ledger rows to completed quantities/costs. Existing Stock ledger fields/rows were fingerprinted before/after migration. See [Manufacturing](manufacturing.md) for full-production scope and limitations.
