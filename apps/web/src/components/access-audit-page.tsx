"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AccessAuditEntry, PageResult } from "@erp/shared";
import { accessAuditQuerySchema } from "@erp/shared";
import { isLive } from "@/lib/api";
import { useCompanyResource } from "@/lib/company-resource";
import { id } from "@/lib/i18n";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { SettingsLinks } from "./settings-links";
import { ResourceState, ListPagination } from "./list-state";
import { Button } from "./ui/button";
export function AccessAuditPage() {
  const { company } = useWorkspace(), search = useSearchParams(), request = search.toString(), [source, setSource] = useState({ companyId: company.id, request });
  if (source.request !== request || (!source.companyId && company.id)) setSource({ companyId: company.id, request });
  return <AccessAudit key={`${company.id}:${request}`} userId={source.companyId === company.id ? search.get("userId") || "" : ""} />;
}
function AccessAudit({ userId }: { userId: string }) {
  const { company, refresh } = useWorkspace(), today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }), week = new Date(`${today}T00:00:00Z`); week.setUTCDate(week.getUTCDate() - 6);
  const defaults = { from: week.toISOString().slice(0, 10), to: today, userId, action: "ALL" };
  const [draft, setDraft] = useState(defaults), [filters, setFilters] = useState(defaults), [page, setPage] = useState(1), [error, setError] = useState("");
  const admin = company.role === "ADMIN", params = new URLSearchParams({ ...filters, page: String(page), pageSize: "10" }), result = useCompanyResource<PageResult<AccessAuditEntry>>(`access/audit?${params}`, 0, admin);
  return <><PageHeader title={id.accessAudit} parent={id.settings} description={`${company.name} · ${id.accessAuditDescription}`} /><SettingsLinks current="access-audit" />{!isLive || !admin ? <section className="panel empty-state"><p>{isLive ? id.accessAdminOnly : id.accessLiveOnly}</p></section> : <><form className="panel mb-5 space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); const parsed = accessAuditQuerySchema.safeParse(draft); if (!parsed.success) { setError(parsed.error.issues[0].message); return; } setError(""); setFilters(draft); setPage(1); }}><div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">{(["from", "to"] as const).map((key) => <label key={key}><span className="field-label">{key === "from" ? id.reportFrom : id.reportTo} *</span><input className="field" type="date" required value={draft[key]} onChange={(e) => setDraft((v) => ({ ...v, [key]: e.target.value }))} /></label>)}<label><span className="field-label">{id.actions}</span><select className="field" value={draft.action} onChange={(e) => setDraft((v) => ({ ...v, action: e.target.value }))}><option value="ALL">{id.accessAllActions}</option><option value="GRANT">{id.accessGranted}</option><option value="UPDATE">{id.accessUpdated}</option></select></label><Button type="submit">{id.apply}</Button></div>{draft.userId && <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((v) => ({ ...v, userId: "" }))}>{id.accessAllUsers}</Button>}{error && <p role="alert" className="field-error">{error}</p>}<p className="text-[11px] text-muted-foreground">{id.accessAuditHint}</p></form><section className="panel overflow-hidden">{result.loading || result.error ? <ResourceState error={result.error} retry={refresh} /> : !result.data?.data.length ? <div className="empty-state"><h2>{id.empty}</h2><p>{id.emptyHint}</p></div> : <div className="table-scroll"><table className="erp-table" aria-label={id.accessAudit}><thead><tr><th>{id.date}</th><th>{id.name}</th><th>{id.actions}</th><th>{id.accessBefore}</th><th>{id.accessAfter}</th><th>{id.accessActor}</th><th>{id.accessReason}</th></tr></thead><tbody>{result.data.data.map((r) => <tr key={r.id}><td className="whitespace-nowrap">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(r.createdAt))}</td><td>{r.after.name}<span className="mt-1 block text-[10px] text-muted-foreground">{r.after.email}</span></td><td>{r.action === "GRANT" ? id.accessGranted : id.accessUpdated}</td><td>{r.before ? `${r.before.role} · ${r.before.active ? id.active : id.inactive}` : "—"}</td><td>{r.after.role} · {r.after.active ? id.active : id.inactive}</td><td>{r.actorName}</td><td className="max-w-60 whitespace-normal">{r.reason}</td></tr>)}</tbody></table></div>}<ListPagination meta={result.data?.meta} loading={result.loading} onPage={setPage} /></section></>}</>;
}
