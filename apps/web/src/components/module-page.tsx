"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Download,
  FileText,
  Info,
  Plus,
  Search,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import type { Transaction } from "@erp/shared";
import { toast } from "sonner";
import { id, statusLabels } from "@/lib/i18n";
import { navigation } from "@/lib/navigation";
import { date, exportCsv, money } from "@/lib/utils";
import { isLive } from "@/lib/api";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { SettingsLinks } from "./settings-links";
import { ModuleShortcut } from "./module-shortcut";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";
import {
  CreateTransactionDialog,
  TransactionDetail,
} from "./transaction-dialog";

const workflows: Record<string, string[]> = {
  procurement: [
    "Purchase Request",
    "Approval",
    "Purchase Order",
    "Purchase Receipt",
    "Purchase Invoice",
    "Payment",
  ],
  "sales-crm": [
    "Quotation",
    "Sales Order",
    "Delivery",
    "Sales Invoice",
    "Payment",
  ],
  inventory: [
    "Stock Receipt",
    "Stock Ledger",
    "Stock Transfer",
    "Stock Adjustment",
  ],
  manufacturing: [
    "Bill of Materials",
    "Production Plan",
    "Work Order",
    "Stock Receipt",
  ],
  accounting: ["Invoice", "Journal Entry", "Payment", "General Ledger"],
  "human-resources": ["Employee", "Department", "Attendance", "Leave Request"],
};
export function ModulePage({ slug }: { slug: string }) {
  const group = navigation.find((item) => item.slug === slug)!;
  const { company, companies, transactions, summary } = useWorkspace();
  const workflow = workflows[group.slug];
  const isFoundation = ["organization", "master-data"].includes(group.slug);
  const groupTransactions = transactions.filter((t) =>
    group.slug === "procurement"
      ? t.type.startsWith("Purchase")
      : group.slug === "sales-crm"
        ? t.type.startsWith("Sales")
        : group.slug === "accounting"
          ? t.type === "Payment"
          : false,
  );
  return (
    <>
      <PageHeader
        title={group.label}
        description={`${group.description} · ${company.name}`}
      />
      {!isFoundation && (
        <div className="notice mb-6">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong className="font-medium">
              {group.slug === "inventory" && isLive
                ? id.inventorySubtitle
                : group.slug === "accounting" && isLive
                  ? id.moduleOverview
                  : id.preview}
            </strong>
            <p>
              {group.slug === "inventory" && isLive
                ? id.stockReceiptReady
                : group.slug === "accounting" && isLive
                  ? id.accountingScope
                  : id.previewHint}
            </p>
          </div>
        </div>
      )}
      <section className="panel mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <h2 className="section-heading">{id.moduleDocuments}</h2>
            <p className="section-description">{id.moduleDescription}</p>
          </div>
          <group.icon size={20} className="text-primary/60" />
        </div>
        <div className="module-links">
          {group.children?.map((child, index) => {
            const count =
              child.slug === "companies"
                ? companies.length
                : child.slug in summary
                  ? summary[child.slug as keyof typeof summary].total
                  : groupTransactions.filter(
                      (t) =>
                        t.type.replaceAll(" ", "").toLowerCase() ===
                        child.label
                          .replaceAll(" ", "")
                          .replace(/s$/, "")
                          .toLowerCase(),
                    ).length;
            return (
              <ModuleShortcut
                className="module-link"
                key={child.slug}
                href={`/${child.slug}`}
                icon={FileText}
                title={child.label}
                description={isFoundation || child.slug === "warehouses"
                      ? `${count} ${id.documents.toLowerCase()}`
                      : isLive &&
                          [
                            "stock-overview",
                            "stock-movement",
                            "stock-transfer",
                            "stock-adjustment",
                            "payments",
                            "accounts-payable",
                            "accounts-receivable",
                          ].includes(child.slug)
                        ? id.available
                        : `${String(index + 1).padStart(2, "0")} · ${id.preview}`}
              />
            );
          })}
        </div>
      </section>
      {workflow && (
        <section className="panel p-6">
          <div className="mb-6 flex items-center gap-2">
            <Workflow size={16} className="text-primary" />
            <h2 className="section-heading">
              {id.workflow} {group.label}
            </h2>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {id.planned}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {workflow.map((step, i) => (
              <div className="flex items-center gap-3" key={step}>
                <span className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2.5 text-[11px] text-slate-600">
                  <span className="text-[9px] text-slate-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {step}
                </span>
                {i !== workflow.length - 1 && (
                  <ChevronRight size={13} className="text-slate-300" />
                )}
              </div>
            ))}
          </div>
          <p className="mt-5 text-[11px] text-muted-foreground">
            {group.slug === "inventory" ? id.stockHint : id.draftHint}
          </p>
        </section>
      )}
      {!isFoundation && groupTransactions.length > 0 && (
        <div className="mt-6">
          <TransactionList
            title={id.recentTransactions}
            rows={groupTransactions.slice(0, 6)}
            compact
          />
        </div>
      )}
      {isFoundation && (
        <div className="notice">
          <Building2 size={16} className="shrink-0" />
          <span>
            {id.companyScope} {id.organizationsHint}
          </span>
        </div>
      )}
    </>
  );
}

export { CompanyPage } from "./company-page";

export function TransactionList({
  title,
  rows,
  compact = false,
  createType,
}: {
  title: string;
  rows: Transaction[];
  compact?: boolean;
  createType?: "Purchase Order" | "Sales Order";
}) {
  const { company, writable } = useWorkspace();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [ascending, setAscending] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [creating, setCreating] = useState(
    params.get("new") === "1" && !!createType && writable && !isLive,
  );
  const filtered = useMemo(
    () =>
      rows
        .filter(
          (t) =>
            `${t.id} ${t.party} ${t.type}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (status === "ALL" || t.status === status),
        )
        .sort((a, b) =>
          ascending
            ? a.date.localeCompare(b.date)
            : b.date.localeCompare(a.date),
        ),
    [rows, query, status, ascending],
  );
  const paged = filtered.slice(page * 10, page * 10 + (compact ? 6 : 10));
  function download() {
    exportCsv(`transaksi-${company.code}.csv`, [
      [
        id.document,
        id.type,
        id.relation,
        id.date,
        id.amount,
        id.currency,
        id.status,
      ],
      ...filtered.map((t) => [
        t.id,
        t.type,
        t.party,
        t.date,
        t.amount,
        company.currency,
        statusLabels[t.status],
      ]),
    ]);
    toast.success(id.exportReady);
  }
  return (
    <>
      {!compact && (
        <PageHeader
          title={title}
          description={`${company.name} · ${id.transactionSubtitle}`}
          actions={
            <>
              <Button variant="outline" onClick={download}>
                <Download />
                {id.export}
              </Button>
              {createType && (
                <Button
                  disabled={!writable || isLive}
                  onClick={() => setCreating(true)}
                >
                  <Plus />
                  {id.createDraft}
                </Button>
              )}
            </>
          }
        />
      )}
      {!compact && (
        <div className="notice mb-5">
          <Info size={16} className="shrink-0" />
          {id.previewHint}
        </div>
      )}
      <section className="panel overflow-hidden">
        {compact ? (
          <div className="table-panel-heading">
            <h2 className="section-heading">{title}</h2>
            <Link className="text-link" href="/reports">
              {id.viewAll}
              <ArrowRight size={12} />
            </Link>
          </div>
        ) : (
          <div className="table-toolbar">
            <div className="toolbar-search">
              <Search size={15} />
              <input
                className="field"
                aria-label={id.search}
                placeholder={id.searchRecords}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <select
              aria-label={id.status}
              className="field !w-auto"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="ALL">{id.allStatus}</option>
              <option value="DRAFT">{id.draft}</option>
              <option value="PENDING">{id.waiting}</option>
              <option value="APPROVED">{id.approved}</option>
              <option value="COMPLETED">{id.completed}</option>
            </select>
          </div>
        )}
        <div className="table-scroll">
          <table className="erp-table">
            <thead>
              <tr>
                <th>{id.document}</th>
                <th>{id.type}</th>
                <th>{id.relation}</th>
                <th>
                  <button onClick={() => setAscending((v) => !v)}>
                    {id.date} {ascending ? "↑" : "↓"}
                  </button>
                </th>
                <th>{id.status}</th>
                <th className="text-right">{id.amount}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((t) => (
                <tr key={t.id}>
                  <td>
                    <button
                      className="document-link"
                      onClick={() => setSelected(t)}
                    >
                      {t.id}
                    </button>
                  </td>
                  <td>{t.type}</td>
                  <td>{t.party}</td>
                  <td>{date(t.date)}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="text-right tabular-nums">
                    {money(t.amount, company.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty-state">
              <FileText size={28} />
              <h3>{id.empty}</h3>
              <p>{id.emptyHint}</p>
            </div>
          )}
        </div>
        {!compact && (
          <div className="list-pagination">
            <span>
              {id.showing(
                filtered.length ? page * 10 + 1 : 0,
                Math.min(page * 10 + 10, filtered.length),
                filtered.length,
              )}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((v) => v - 1)}
              >
                {id.previous}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={(page + 1) * 10 >= filtered.length}
                onClick={() => setPage((v) => v + 1)}
              >
                {id.next}
              </Button>
            </div>
          </div>
        )}
      </section>
      <TransactionDetail
        transaction={selected}
        onClose={() => setSelected(null)}
      />
      <CreateTransactionDialog
        type={createType}
        open={creating}
        onClose={() => setCreating(false)}
      />
    </>
  );
}
export function DocumentPage({ slug, label }: { slug: string; label: string }) {
  const { transactions } = useWorkspace();
  const typeMap: Record<string, Transaction["type"]> = {
    "purchase-orders": "Purchase Order",
    "purchase-invoices": "Purchase Invoice",
    "sales-orders": "Sales Order",
    "sales-invoices": "Sales Invoice",
    payments: "Payment",
  };
  const type = typeMap[slug];
  return (
    <TransactionList
      title={id.list(label)}
      rows={transactions.filter((t) => t.type === type)}
      createType={
        type === "Purchase Order" || type === "Sales Order" ? type : undefined
      }
    />
  );
}
export function SnapshotReportsPage() {
  const { transactions } = useWorkspace();
  return (
    <>
      <div className="notice mb-5">
        <Info size={16} />
        <p>{id.reportDemoHint}</p>
      </div>
      <TransactionList title="Reports & Analytics" rows={transactions} />
      <p className="mt-4 text-xs text-muted-foreground">{id.reportsHint}</p>
    </>
  );
}
export function SettingsPage() {
  const { user, companies, company } = useWorkspace();
  return (
    <>
      <PageHeader title={id.settings} description={id.permissionsHint} actions={isLive && <Button asChild variant="outline"><Link href="/change-password">{id.passwordChange}</Link></Button>} />
      <SettingsLinks current="settings" />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <section className="panel p-6">
          <div className="mb-6 flex items-center gap-2">
            <Users size={17} className="text-primary" />
            <h2 className="section-heading">{id.profile}</h2>
          </div>
          <dl className="space-y-5">
            {[
              [id.name, user.name],
              [id.email, user.email],
              [id.activeCompany, company.name],
              [id.role, company.role],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] text-muted-foreground">{label}</dt>
                <dd className="mt-1.5 text-xs font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="notice mt-6">
            <Info size={15} className="shrink-0" />
            {isLive ? id.live : id.demoExplanation}
          </div>
        </section>
        <section className="panel overflow-hidden">
          <div className="flex items-center gap-2 p-6">
            <ShieldCheck size={17} className="text-primary" />
            <h2 className="section-heading">{id.permissionsTitle}</h2>
          </div>
          <div className="table-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>{id.permission}</th>
                  <th>Admin</th>
                  <th>Manager</th>
                  <th>Viewer</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [id.read, true, true, true],
                  [id.write, true, true, false],
                  [id.postStockTransfer, true, true, false],
                  [id.postStockAdjustment, true, false, false],
                  [id.addRecord(id.employee), true, true, false],
                  [id.leaveApprove, true, true, false],
                  [id.journalPost, true, true, false],
                  [id.journalReverse, true, false, false],
                  [id.workOrderComplete, true, true, false],
                  [id.delete, true, true, false],
                  [id.usersAccess, true, false, false],
                ].map(([label, ...values]) => (
                  <tr key={String(label)}>
                    <td>{label}</td>
                    {values.map((v, i) => (
                      <td key={i}>
                        {v ? (
                          <Check size={14} className="text-primary" />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6">
            <p className="mb-4 text-[11px] text-muted-foreground">
              {id.hrReviewerHint}
            </p>
            <p className="mb-4 text-[11px] text-muted-foreground">{id.accessPolicy}</p>
            <h3 className="mb-4 text-xs font-medium">{id.accessCompany}</h3>
            {companies.map((c) => (
              <div
                className="flex items-center gap-3 border-b py-3 last:border-0"
                key={c.id}
              >
                <Building2 size={15} className="text-slate-400" />
                <span className="flex-1 text-xs">{c.name}</span>
                <span className="rounded bg-muted px-2 py-1 text-[9px] text-slate-500">
                  {c.role}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
export { StockPage } from "./stock-page";
