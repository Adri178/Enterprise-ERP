"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { draftSchema, type Transaction } from "@erp/shared";
import { z } from "zod";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { id } from "@/lib/i18n";
import { date, money } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";

export function TransactionDetail({
  transaction,
  onClose,
}: {
  transaction: Transaction | null;
  onClose: () => void;
}) {
  const { company } = useWorkspace();
  return (
    <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold">
          {id.transactionDetail}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          {transaction?.id}
        </DialogDescription>
        {transaction && (
          <>
            <div className="flex items-center justify-between rounded-lg bg-muted p-4">
              <span className="text-sm font-medium">{transaction.type}</span>
              <StatusBadge status={transaction.status} />
            </div>
            <dl className="grid grid-cols-2 gap-6 text-xs">
              {[
                [id.relation, transaction.party],
                [id.company, company.name],
                [id.date, date(transaction.date, true)],
                [id.amount, money(transaction.amount, company.currency)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-2 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {transaction.description && (
              <p className="text-sm text-muted-foreground">
                {transaction.description}
              </p>
            )}
            <div className="notice">
              <Info size={16} className="mt-0.5 shrink-0" />
              {id.previewHint}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                {id.close}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function CreateTransactionDialog({
  open,
  onClose,
  type = "Purchase Order",
}: {
  open: boolean;
  onClose: () => void;
  type?: "Purchase Order" | "Sales Order";
}) {
  const { company, addDraft, records } = useWorkspace();
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<z.infer<typeof draftSchema>>({
    resolver: zodResolver(draftSchema),
    defaultValues: {
      party: "",
      amount: 0,
      date: "2026-10-21",
      description: "",
    },
  });
  const parties =
    type === "Purchase Order" ? records.suppliers : records.customers;
  async function submit(values: z.infer<typeof draftSchema>) {
    setSaving(true);
    try {
      addDraft({ ...values, type });
      reset();
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold">
          {type === "Purchase Order" ? id.createPO : id.createSO}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          {company.name} · {id.draftNumber}
        </DialogDescription>
        <form onSubmit={handleSubmit(submit)} className="space-y-5">
          <div className="notice">
            <Info size={16} className="shrink-0" />
            {id.draftHint}
          </div>
          <div>
            <label htmlFor="draft-party" className="field-label">
              {type === "Purchase Order" ? "Supplier" : "Customer"} *
            </label>
            <select id="draft-party" className="field" {...register("party")}>
              <option value="">{id.search}</option>
              {parties
                .filter((p) => p.status === "ACTIVE")
                .map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
            </select>
            {errors.party && (
              <span className="field-error">{errors.party.message}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="draft-date" className="field-label">
                {id.date} *
              </label>
              <input
                id="draft-date"
                type="date"
                className="field"
                {...register("date")}
              />
              {errors.date && (
                <span className="field-error">{errors.date.message}</span>
              )}
            </div>
            <div>
              <label htmlFor="draft-amount" className="field-label">
                {id.amount} ({company.currency}) *
              </label>
              <input
                id="draft-amount"
                type="number"
                className="field"
                {...register("amount", { valueAsNumber: true })}
              />
              {errors.amount && (
                <span className="field-error">{errors.amount.message}</span>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="draft-description" className="field-label">
              {id.description}
            </label>
            <textarea
              id="draft-description"
              className="field"
              {...register("description")}
            />
          </div>
          <div className="flex justify-end gap-2 border-t pt-5">
            <Button type="button" variant="outline" onClick={onClose}>
              {id.cancel}
            </Button>
            <Button disabled={saving} type="submit">
              {saving && <Loader2 className="animate-spin" />}
              {id.createDraft}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
