"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { id } from "@/lib/i18n";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { Button } from "./ui/button";
import { TradePage } from "./trade-page";
export function PaymentsPage() {
  const { company } = useWorkspace(),
    [domain, setDomain] = useState<"procurement" | "sales">("procurement"),
    tabId = useId();
  return (
    <>
      <PageHeader
        title="Payments"
        parent="Accounting"
        description={`${company.name} · ${id.paymentsDescription}`}
        actions={
          <Button asChild variant="outline">
            <Link
              href={
                domain === "sales" ? "/sales-invoices" : "/purchase-invoices"
              }
            >
              {domain === "sales" ? id.salesInvoice : id.purchaseInvoice}
              <ArrowRight />
            </Link>
          </Button>
        }
      />
      <div
        role="group"
        aria-label={id.paymentDirection}
        className="mb-4 flex flex-wrap gap-2"
      >
        {(["procurement", "sales"] as const).map((value) => (
          <Button
            key={value}
            aria-pressed={domain === value}
            aria-controls={tabId}
            variant={domain === value ? "default" : "outline"}
            onClick={() => setDomain(value)}
          >
            {value === "sales" ? id.paymentIncoming : id.paymentOutgoing}
          </Button>
        ))}
      </div>
      <div id={tabId}>
        <TradePage
          key={domain}
          domain={domain}
          slug={domain === "sales" ? "sales-payments" : "payments"}
          embedded
        />
      </div>
    </>
  );
}
