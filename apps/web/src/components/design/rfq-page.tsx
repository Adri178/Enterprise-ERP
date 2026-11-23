"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { id } from "@/lib/i18n";
import { date } from "@/lib/utils";
import { demoItems, nextDesignNumber, rfqSchema, selectOffer, type Offer, type Rfq, type RfqInput } from "@/lib/design/models";
import { rfqFixtures } from "@/lib/design/fixtures";
import { useDesignRecords } from "@/lib/design/use-design-records";
import { useWorkspace } from "../workspace-provider";
import { PageHeader } from "../page-header";
import { Button } from "../ui/button";
import { DesignConfirm, DesignNotice, DesignSummary, DesignTable } from "./common";
import { RfqForm } from "./rfq-form";
import { RfqBadge, RfqDetail } from "./rfq-detail";

const d = id.design;
export function RfqPage() { const { company } = useWorkspace(); return <RfqWorkspace key={company.id} />; }
function RfqWorkspace() {
  const { company, writable } = useWorkspace(), store = useDesignRecords("rfq", rfqSchema, rfqFixtures);
  const [editing, setEditing] = useState<Rfq | "new" | null>(null), [selectedId, setSelectedId] = useState<string | null>(null), [confirmation, setConfirmation] = useState<{ record: Rfq; action: "delete" | "cancel" } | null>(null);
  const selected = store.rows.find(record => record.id === selectedId);
  function save(input: RfqInput) {
    store.update(rows => editing && editing !== "new" ? rows.map(row => { if (row.id !== editing.id) return row; if (row.status !== "DRAFT") throw new Error(d.invalidTransition); return { ...row, ...input, updatedAt: new Date().toISOString() }; }) : [{ ...input, id: crypto.randomUUID(), companyId: company.id, number: nextDesignNumber("RFQ", company.code, rows), status: "DRAFT", offers: [], selectedSupplierId: "", updatedAt: new Date().toISOString() }, ...rows]);
    setEditing(null); toast.success(d.saved);
  }
  function change(transform: (record: Rfq) => Rfq) {
    store.update(rows => rows.map(row => row.id === selectedId ? transform(row) : row)); toast.success(d.changed);
  }
  function offer(input: Offer) {
    change(record => { if (record.status !== "SENT") throw new Error(d.invalidTransition); return { ...record, offers: [...record.offers.filter(offer => offer.supplierId !== input.supplierId), input], updatedAt: new Date().toISOString() }; });
  }
  function confirm() {
    if (!confirmation) return;
    try {
      store.update(rows => confirmation.action === "delete" ? rows.filter(row => { if (row.id === confirmation.record.id && row.status !== "DRAFT") throw new Error(d.invalidTransition); return row.id !== confirmation.record.id; }) : rows.map(row => { if (row.id !== confirmation.record.id) return row; if (!["DRAFT", "SENT"].includes(row.status)) throw new Error(d.invalidTransition); return { ...row, status: "CANCELLED", updatedAt: new Date().toISOString() }; }));
      setConfirmation(null); toast.success(confirmation.action === "delete" ? d.removed : d.changed);
    } catch (error) { toast.error(error instanceof Error ? error.message : d.saveError); }
  }
  const columns: ColumnDef<Rfq>[] = [
    { accessorKey: "number", header: id.code, cell: ({ row }) => <button className="document-link" onClick={() => setSelectedId(row.original.id)}>{row.original.number}</button> },
    { accessorKey: "title", header: d.rfqTitle, cell: ({ row }) => <div><span className="block font-medium">{row.original.title}</span><span className="mt-1 block text-xs text-muted-foreground">{row.original.requestReference || "—"}</span></div> },
    { id: "items", header: d.requirements, accessorFn: row => row.lines.map(line => demoItems.find(item => item.id === line.itemId)?.name).join(", ") },
    { accessorKey: "deadline", header: d.deadline, cell: ({ row }) => date(row.original.deadline) },
    { id: "offers", header: d.offers, accessorFn: row => `${row.offers.length}/${row.supplierIds.length}` },
    { id: "status", header: id.status, accessorFn: row => d.rfqStatus[row.status], cell: ({ row }) => <RfqBadge record={row.original} /> },
    { id: "actions", header: id.actions, cell: ({ row }) => <Button size="sm" variant="ghost" onClick={() => setSelectedId(row.original.id)}>{d.detail}</Button> },
  ];
  return <><PageHeader title={d.rfq} parent="Procurement" description={`${company.name} · ${d.rfqDescription}`} actions={<Button disabled={!writable || store.loading || !!store.error} onClick={() => setEditing("new")}><Plus />{d.add} RFQ</Button>} /><DesignNotice>{d.rfqBoundary}</DesignNotice><DesignSummary items={[{ label: d.rfqStatus.DRAFT, value: store.rows.filter(row => row.status === "DRAFT").length }, { label: d.rfqStatus.SENT, value: store.rows.filter(row => row.status === "SENT").length }, { label: d.rfqStatus.SELECTED, value: store.rows.filter(row => row.status === "SELECTED").length }]} /><DesignTable title={d.rfq} rows={store.rows} columns={columns} searchHint={d.rfqSearch} statusLabels={d.rfqStatus} statusOf={row => row.status} loading={store.loading} error={store.error} retry={store.retry} filename={`demo-rfq-${company.code}.csv`} />
    {editing && <RfqForm record={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSave={save} />}
    {selected && <RfqDetail key={selected.id} record={selected} onClose={() => setSelectedId(null)} onEdit={() => { setEditing(selected); setSelectedId(null); }} onDelete={() => { setConfirmation({ record: selected, action: "delete" }); setSelectedId(null); }} onCancel={() => { setConfirmation({ record: selected, action: "cancel" }); setSelectedId(null); }} onSend={() => { try { change(record => { if (record.status !== "DRAFT") throw new Error(d.invalidTransition); return { ...record, status: "SENT", updatedAt: new Date().toISOString() }; }); } catch (error) { toast.error(error instanceof Error ? error.message : d.saveError); } }} onOffer={offer} onSelect={supplierId => { try { change(record => selectOffer(record, supplierId)); } catch (error) { toast.error(error instanceof Error ? error.message : d.saveError); } }} />}
    {confirmation && <DesignConfirm title={confirmation.action === "delete" ? d.confirmRemove : d.rfqCancel} description={confirmation.action === "delete" ? d.confirmRemoveHint : d.rfqCancelHint} onClose={() => setConfirmation(null)} onConfirm={confirm} />}
  </>;
}
