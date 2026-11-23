"use client";
import { TradePage } from "./trade-page";
export function SalesPage({ slug = "sales-crm" }: { slug?: string }) {
  return <TradePage domain="sales" slug={slug} />;
}
