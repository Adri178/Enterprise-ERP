"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { accountTypes, type Account, type PageResult } from "@erp/shared";
import { ArrowDownUp, ArrowRight, Folder, Plus, Search } from "lucide-react";
import { id, accountTypeLabels } from "@/lib/i18n";
import { isLive } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { useDebouncedValue } from "@/lib/catalog-hooks";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { AccountingNotice } from "./accounting-notice";
import { AccountForm } from "./account-form";
import { ResourceState, ListPagination } from "./list-state";
import { StatusBadge } from "./ui/badge";
import { Button } from "./ui/button";
export function AccountsPage() { const { company } = useWorkspace(); return <AccountDirectory key={company.id} />; }
function AccountDirectory() {
  const search = useSearchParams(), initialQuery = search.get("q") || "";
  const { company, writable, refresh } = useWorkspace(), [q, setQ] = useState(initialQuery), [type, setType] = useState("ALL"), [node, setNode] = useState("ALL"), [status, setStatus] = useState("ALL"), [page, setPage] = useState(1), [direction, setDirection] = useState("asc"), [revision, setRevision] = useState(0), [editing, setEditing] = useState<Account | "new" | null>(null);
  useEffect(() => { setQ(initialQuery); setPage(1); }, [initialQuery]);
  const query = useDebouncedValue(q), params = new URLSearchParams({ q: query, type, node, status, page: String(page), pageSize: "10", direction });
  const result = useCompanyResource<PageResult<Account>>(`accounting/accounts?${params}`, revision), changed = () => { setRevision((v) => v + 1); refresh(); };
  return <><PageHeader title={id.chartOfAccounts} parent={id.accountingTitle} description={`${company.name} · ${id.accountDescription}`} actions={<Button disabled={!isLive || !writable} onClick={() => setEditing("new")}><Plus />{id.addRecord(id.account)}</Button>} /><AccountingNotice />
    <section className="panel overflow-hidden"><div className="table-toolbar"><div className="toolbar-search"><Search size={15} /><input className="field" aria-label={id.search} maxLength={120} placeholder={id.accountSearch} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div><div className="flex flex-wrap gap-2"><select className="field !w-auto" aria-label={id.accountType} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="ALL">{id.allTypes}</option>{accountTypes.map((t) => <option key={t} value={t}>{accountTypeLabels[t]}</option>)}</select><select className="field !w-auto" aria-label={id.accountNode} value={node} onChange={(e) => { setNode(e.target.value); setPage(1); }}><option value="ALL">{id.allTypes}</option><option value="GROUP">{id.accountGroup}</option><option value="LEDGER">{id.accountLedger}</option></select><select className="field !w-auto" aria-label={id.status} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="ALL">{id.allStatus}</option><option value="ACTIVE">{id.active}</option><option value="INACTIVE">{id.inactive}</option></select></div></div>
      {!isLive ? <div className="empty-state"><p>{id.accountingLiveOnly}</p></div> : result.loading || result.error ? <ResourceState error={result.error} retry={changed} /> : !result.data?.data.length ? <div className="empty-state"><h2>{id.empty}</h2><p>{id.emptyHint}</p></div> : <div className="table-scroll"><table className="erp-table" aria-label={id.chartOfAccounts}><thead><tr><th aria-sort={direction === "asc" ? "ascending" : "descending"}><button className="flex items-center gap-1" onClick={() => { setDirection((v) => v === "asc" ? "desc" : "asc"); setPage(1); }}>{id.code}<ArrowDownUp size={12} /></button></th><th>{id.accountName}</th><th>{id.accountType}</th><th>{id.accountParent}</th><th>{id.accountNode}</th><th>{id.status}</th><th>{id.actions}</th></tr></thead><tbody>{result.data.data.map((row) => <tr key={row.id}><td className="font-medium">{row.code}</td><td><button className="text-link inline-flex items-center gap-2" onClick={() => setEditing(row)}>{row.isGroup && <Folder size={13} />}{row.name}</button></td><td>{accountTypeLabels[row.type]}</td><td>{row.parentCode ? `${row.parentCode} · ${row.parentName}` : "—"}</td><td>{row.isGroup ? id.accountGroup : id.accountLedger}</td><td><StatusBadge status={row.status} /></td><td>{!row.isGroup && <Button asChild size="sm" variant="ghost"><Link href={`/general-ledger?accountId=${row.id}`}>{id.generalLedger}<ArrowRight /></Link></Button>}</td></tr>)}</tbody></table></div>}
      <ListPagination meta={result.data?.meta} loading={result.loading} onPage={setPage} />
    </section><p className="mt-4 text-[11px] text-muted-foreground">{id.accountStructureHint}</p>
    {editing && <AccountForm record={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); changed(); }} />}
  </>;
}
