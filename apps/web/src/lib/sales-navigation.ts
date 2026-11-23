import type { SalesKind } from "@erp/shared";
export const salesRoutes: Record<string, SalesKind> = {
  quotations: "QUOTATION",
  "sales-orders": "SALES_ORDER",
  "delivery-notes": "DELIVERY_NOTE",
  "sales-invoices": "SALES_INVOICE",
  "sales-payments": "PAYMENT",
  "accounts-receivable": "SALES_INVOICE",
};
