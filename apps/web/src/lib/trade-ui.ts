import {
  allowedPurchaseActions,
  nextPurchaseKind,
  nextSalesKind,
  purchaseKinds,
  purchaseStatuses,
  salesKinds,
  salesStatuses,
  type PurchaseAction,
  type PurchaseDocument,
  type PurchaseKind,
  type PurchaseLine,
  type PurchaseStatus,
  type PurchaseSummary,
  type SalesDocument,
  type SalesKind,
  type SalesSummary,
} from "@erp/shared";
import { id, purchaseLabels, salesLabels } from "./i18n";
import { purchaseRoutes } from "./purchase-navigation";
import { salesRoutes } from "./sales-navigation";
import { money, number } from "./utils";
export type TradeDomain = "procurement" | "sales";
export type TradeKind = PurchaseKind | SalesKind;
export type TradeDocument = Omit<
  PurchaseDocument,
  "kind" | "supplierId" | "supplierName" | "lines" | "successors"
> & {
  kind: TradeKind;
  partyId: string;
  partyName: string;
  lines: (PurchaseLine & { stockCost?: number | null })[];
  successors: {
    id: string;
    number: string;
    kind: TradeKind;
    status: PurchaseStatus;
  }[];
};
export function toTradeDocument(
  row: PurchaseDocument | SalesDocument,
): TradeDocument {
  return {
    ...row,
    partyId: "supplierId" in row ? row.supplierId : row.customerId,
    partyName: "supplierName" in row ? row.supplierName : row.customerName,
  };
}
export function tradeSpec(domain: TradeDomain) {
  return domain === "sales"
    ? {
        title: id.salesTitle,
        description: id.salesDescription,
        party: id.customer,
        initialKind: "QUOTATION" as TradeKind,
        invoiceKind: "SALES_INVOICE",
        create: id.createQuotation,
        formHint: id.quotationSubtitle,
        saved: id.quotationSaved,
        scope: id.salesScope,
        postHint: id.salesPostingHint,
        labels: salesLabels,
        kinds: salesKinds as readonly TradeKind[],
        statuses: salesStatuses as readonly string[],
        routes: salesRoutes as Record<string, TradeKind>,
        initialHref: "/quotations",
        empty: id.quotationEmpty,
        emptyHint: id.quotationEmptyHint,
        search: id.salesSearch,
      }
    : {
        title: id.procurementTitle,
        description: id.procurementDescription,
        party: "Supplier",
        initialKind: "PURCHASE_REQUEST" as TradeKind,
        invoiceKind: "PURCHASE_INVOICE",
        create: id.createRequest,
        formHint: id.requestSubtitle,
        saved: id.purchaseSaved,
        scope: id.purchaseScope,
        postHint: id.postingHint,
        labels: purchaseLabels,
        kinds: purchaseKinds as readonly TradeKind[],
        statuses: purchaseStatuses as readonly string[],
        routes: purchaseRoutes as Record<string, TradeKind>,
        initialHref: "/purchase-requests",
        empty: id.requestEmpty,
        emptyHint: id.requestEmptyHint,
        search: id.documentSearch,
      };
}
export function tradeNext(
  domain: TradeDomain,
  kind: TradeKind,
): TradeKind | undefined {
  return domain === "sales"
    ? nextSalesKind[kind as SalesKind]
    : nextPurchaseKind[kind as PurchaseKind];
}
export function tradeActions(
  domain: TradeDomain,
  doc: TradeDocument,
): PurchaseAction[] {
  return domain === "sales"
    ? doc.status === "DRAFT"
      ? ["post", "cancel"]
      : []
    : allowedPurchaseActions(doc.kind as PurchaseKind, doc.status);
}
export function tradeMetrics(
  domain: TradeDomain,
  data: PurchaseSummary | SalesSummary | undefined,
  currency: string,
) {
  const sales = data && "sales" in data ? data : undefined,
    purchase = data && "purchases" in data ? data : undefined;
  return domain === "sales"
    ? [
        {
          label: id.postedSalesOrders,
          value: number(sales?.ordersPosted || 0),
        },
        { label: id.totalSales, value: money(sales?.sales || 0, currency) },
        {
          label: id.receivableOutstanding,
          value: money(sales?.outstanding || 0, currency),
        },
        {
          label: id.receivedTotal,
          value: money(sales?.received || 0, currency),
        },
      ]
    : [
        { label: id.pending, value: number(purchase?.requestsPending || 0) },
        { label: id.postedOrders, value: number(purchase?.ordersPosted || 0) },
        {
          label: id.totalPurchases,
          value: money(purchase?.purchases || 0, currency),
        },
        {
          label: id.outstanding,
          value: money(purchase?.outstanding || 0, currency),
        },
      ];
}
