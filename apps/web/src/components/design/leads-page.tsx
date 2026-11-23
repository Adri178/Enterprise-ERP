"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { id } from "@/lib/i18n";
import { money } from "@/lib/utils";
import { leadSchema, nextDesignNumber, transitionLead, type Lead, type LeadInput } from "@/lib/design/models";
import { leadFixtures } from "@/lib/design/fixtures";
import { useDesignRecords } from "@/lib/design/use-design-records";
import { useWorkspace } from "../workspace-provider";
import { PageHeader } from "../page-header";
import { Button } from "../ui/button";
import { DesignBadge, DesignConfirm, DesignDialog, DesignFacts, DesignNotice, DesignSummary, DesignTable } from "./common";
import { LeadForm } from "./lead-form";

const d = id.design;
const badge = (record: Lead) => <DesignBadge tone={record.status === "QUALIFIED" ? "green" : record.status === "CONTACTED" ? "amber" : record.status === "LOST" ? "red" : "neutral"}>{d.leadStatus[record.status]}</DesignBadge>;
export function LeadsPage() { const { company } = useWorkspace(); return <LeadWorkspace key={company.id} />; }
function LeadWorkspace() {
  const { company, writable, user } = useWorkspace(), store = useDesignRecords("leads", leadSchema, leadFixtures);
  const [editing, setEditing] = useState<Lead | "new" | null>(null), [selectedId, setSelectedId] = useState<string | null>(null), [deleting, setDeleting] = useState<Lead | null>(null);
  const selected = store.rows.find(record => record.id === selectedId);
  function save(input: LeadInput) {
    store.update(rows => editing && editing !== "new" ? rows.map(row => row.id === editing.id ? { ...row, ...input, updatedAt: new Date().toISOString() } : row) : [{ ...input, id: crypto.randomUUID(), companyId: company.id, number: nextDesignNumber("LD", company.code, rows), status: "NEW", updatedAt: new Date().toISOString() }, ...rows]);
    setEditing(null); toast.success(d.saved);
  }
  function stage(status: Lead["status"]) {
    try { store.update(rows => rows.map(row => row.id === selectedId ? transitionLead(row, status) : row)); toast.success(d.changed); }
    catch (error) { toast.error(error instanceof Error ? error.message : d.saveError); }
  }
  const columns: ColumnDef<Lead>[] = [
    { accessorKey: "number", header: id.code, cell: ({ row }) => <button className="document-link" onClick={() => setSelectedId(row.original.id)}>{row.original.number}</button> },
    { accessorKey: "contact", header: d.contact, cell: ({ row }) => <div><strong className="block font-medium">{row.original.contact}</strong><span className="mt-1 block text-xs text-muted-foreground">{row.original.email || row.original.phone || "—"}</span></div> },
    { accessorKey: "organization", header: d.organization }, { accessorKey: "owner", header: d.owner },
    { id: "source", accessorFn: row => d.leadSource[row.source], header: d.source },
    { accessorKey: "potential", header: d.potential, cell: ({ row }) => <span className="tabular-nums">{money(row.original.potential, company.currency)}</span> },
    { id: "status", accessorFn: row => d.leadStatus[row.status], header: id.status, cell: ({ row }) => badge(row.original) },
    { id: "actions", header: id.actions, cell: ({ row }) => <Button size="sm" variant="ghost" onClick={() => setSelectedId(row.original.id)}>{d.detail}</Button> },
  ];
  return <><PageHeader title={d.leads} parent="Sales & CRM" description={`${company.name} · ${d.leadsDescription}`} actions={<Button disabled={!writable || store.loading || !!store.error} onClick={() => setEditing("new")}><Plus />{d.add} Lead</Button>} /><DesignNotice>{d.leadBoundary}</DesignNotice><DesignSummary items={[{ label: d.leadStatus.NEW, value: store.rows.filter(row => row.status === "NEW").length }, { label: d.leadStatus.QUALIFIED, value: store.rows.filter(row => row.status === "QUALIFIED").length }, { label: d.potential, value: money(store.rows.filter(row => row.status !== "LOST").reduce((sum, row) => sum + row.potential, 0), company.currency, true) }]} /><DesignTable title={d.leads} rows={store.rows} columns={columns} searchHint={d.leadSearch} statusLabels={d.leadStatus} statusOf={row => row.status} loading={store.loading} error={store.error} retry={store.retry} filename={`demo-leads-${company.code}.csv`} />
    {editing && <LeadForm record={editing === "new" ? undefined : editing} owner={user.name} onClose={() => setEditing(null)} onSave={save} />}
    {selected && <DesignDialog title={selected.contact} description={`${selected.number} · ${company.name}`} onClose={() => setSelectedId(null)}><div>{badge(selected)}</div><DesignFacts items={[{ label: d.organization, value: selected.organization }, { label: d.owner, value: selected.owner }, { label: id.email, value: selected.email }, { label: id.phone, value: selected.phone }, { label: d.source, value: d.leadSource[selected.source] }, { label: d.potential, value: money(selected.potential, company.currency) }]} /><p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.description || "—"}</p><div className="flex flex-wrap gap-2 border-t pt-4">{writable && <><Button variant="outline" onClick={() => { setEditing(selected); setSelectedId(null); }}><Pencil />{d.edit}</Button><Button variant="ghost" onClick={() => { setDeleting(selected); setSelectedId(null); }}><Trash2 />{d.remove}</Button>{selected.status === "NEW" && <Button onClick={() => stage("CONTACTED")}>{d.contactLead}</Button>}{selected.status === "CONTACTED" && <Button onClick={() => stage("QUALIFIED")}>{d.qualifyLead}</Button>}{["NEW", "CONTACTED"].includes(selected.status) && <Button variant="outline" onClick={() => stage("LOST")}>{d.closeLead}</Button>}</>}{selected.status === "QUALIFIED" && <Button asChild variant="outline"><Link href="/quotations">{d.quotationLink}<ArrowRight /></Link></Button>}</div></DesignDialog>}
    {deleting && <DesignConfirm onClose={() => setDeleting(null)} onConfirm={() => { try { store.update(rows => rows.filter(row => row.id !== deleting.id)); setDeleting(null); toast.success(d.removed); } catch (error) { toast.error(error instanceof Error ? error.message : d.saveError); } }} />}
  </>;
}
