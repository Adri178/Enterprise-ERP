import type { PurchaseKind } from "@erp/shared";
export const purchaseRoutes: Record<string, PurchaseKind> = {
  "purchase-requests": "PURCHASE_REQUEST",
  "purchase-orders": "PURCHASE_ORDER",
  "purchase-receipts": "PURCHASE_RECEIPT",
  "purchase-invoices": "PURCHASE_INVOICE",
  payments: "PAYMENT",
  "accounts-payable": "PURCHASE_INVOICE",
};
