"use client";
import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardList, Layers, FileClock, CircleCheck } from "lucide-react";
import { id } from "@/lib/i18n";
import { isLive } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { number } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { AccountingNotice } from "./accounting-notice";
import { ResourceState } from "./list-state";
import { SummaryStrip } from "./summary-strip";
import { ModuleShortcut } from "./module-shortcut";
import { Button } from "./ui/button";

export function AccountingPage() {
  const { company, refresh } = useWorkspace();
  const result = useCompanyResource<{ accounts: number; activeLedger: number; posted: number; drafts: number }>("accounting/summary");
  const shortcuts = [
    { href: "/automatic-accounting", title: id.automaticAccounting, description: id.automaticDescription, icon: Layers },
    { href: "/chart-of-accounts", title: id.chartOfAccounts, description: id.accountDescription, icon: Layers },
    { href: "/journal-entries", title: id.journalEntries, description: id.journalDraftHint, icon: ClipboardList },
    { href: "/general-ledger", title: id.generalLedger, description: id.ledgerDescription, icon: BookOpen },
    { href: "/trial-balance", title: id.trialBalance, description: id.trialDescription, icon: BookOpen },
  ];
  return (
    <>
      <PageHeader
        title={id.accountingTitle}
        description={`${company.name} · ${id.accountingDescription}`}
        actions={<Button asChild><Link href="/journal-entries">{id.journalEntries}<ArrowRight /></Link></Button>}
      />
      <AccountingNotice />
      {isLive && <SummaryStrip
        label={`${id.accountingTitle} · ${id.overview}`}
        loading={result.loading}
        unavailable={!!result.error}
        items={[
          { label: id.accountingAccounts, value: number(result.data?.activeLedger || 0), icon: BookOpen },
          { label: id.accountingPosted, value: number(result.data?.posted || 0), icon: CircleCheck },
          { label: id.accountingDrafts, value: number(result.data?.drafts || 0), icon: FileClock },
        ]}
      />}
      {result.error && <div className="panel mb-5"><ResourceState error={result.error} retry={refresh} /></div>}
      <div className="accounting-workspace">
        <section className="panel module-list" aria-label={id.accountingTitle}>
          {shortcuts.map(item => <ModuleShortcut key={item.href} {...item} />)}
        </section>
        <section className="panel settlement-panel">
          <h2 className="section-heading">{id.accountingSettlements}</h2>
          <p className="section-description">{id.workspaceUi.settlementsHint}</p>
          <div className="settlement-links">
            {[["/accounts-receivable", "Accounts Receivable"], ["/accounts-payable", "Accounts Payable"], ["/payments", "Payments"]].map(([href, label]) => (
              <Link href={href} key={href} className="settlement-link">{label}<ArrowRight size={16} aria-hidden="true" /></Link>
            ))}
          </div>
          <p className="settlement-note">{id.journalReverseHint}</p>
        </section>
      </div>
    </>
  );
}
