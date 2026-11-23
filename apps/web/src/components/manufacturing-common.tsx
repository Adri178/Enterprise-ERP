"use client";
import Link from "next/link";
import { Info } from "lucide-react";
import { id } from "@/lib/i18n";
import { isLive } from "@/lib/api";
import { cn } from "@/lib/utils";
export function ManufacturingNotice() { return <div className="notice mb-5 items-start"><Info size={16} className="mt-0.5 shrink-0" /><p>{isLive ? id.manufacturingScope : id.manufacturingLiveOnly}</p></div>; }
export function ManufacturingLinks({ current }: { current: string }) { return <nav aria-label={id.manufacturing} className="mb-5 flex flex-wrap gap-1 border-b">{[["manufacturing", id.manufacturing], ["bill-of-materials", id.bom], ["work-orders", id.workOrders], ["production-plan", id.productionPlan]].map(([slug, label]) => <Link key={slug} href={`/${slug}`} aria-current={current === slug ? "page" : undefined} className={cn("border-b-2 px-4 py-3 text-xs transition-colors", current === slug ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-primary")}>{label}</Link>)}</nav>; }
