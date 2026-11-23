"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  companySchema,
  currencies,
  type Company,
  type CompanyInput,
} from "@erp/shared";
import { z } from "zod";
import {
  ArrowRight,
  Building2,
  Check,
  Info,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Archive,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { id } from "@/lib/i18n";
import { useWorkspace } from "./workspace-provider";
import { PageHeader } from "./page-header";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function CompanyPage() {
  const {
    companies,
    company,
    switchCompany,
    archiveCompany,
    saveCompany,
    loading,
    error,
    refresh,
  } = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<Company | "new" | null>(null);
  const [archiving, setArchiving] = useState<Company | null>(null);
  const [busy, setBusy] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const canCreate = companies.some((c) => c.role === "ADMIN");
  const rows = companies.filter(
    (c) =>
      `${c.name} ${c.code} ${c.city}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "ALL" || c.status === status),
  );
  async function archive() {
    if (!archiving) return;
    setBusy(true);
    setArchiveError("");
    try {
      await archiveCompany(archiving.id);
      setArchiving(null);
    } catch (error) {
      setArchiveError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function activate(profile: Company) {
    try {
      await saveCompany(
        { ...profile, status: "ACTIVE" },
        profile.id,
        profile.updatedAt,
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  return (
    <>
      <PageHeader
        title={id.list("Company")}
        parent="Organization"
        description={id.organizationsHint}
        actions={
          <Button
            disabled={!canCreate || loading}
            onClick={() => setSelected("new")}
          >
            <Plus />
            {id.addRecord("Company")}
          </Button>
        }
      />
      <section className="panel overflow-hidden">
        <div className="table-toolbar">
          <div className="toolbar-search">
            <Search size={15} />
            <input
              className="field"
              aria-label={id.searchRecords}
              placeholder={id.searchRecords}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] text-muted-foreground sm:block">
              {companies.length} {id.companyCount}
            </span>
            <select
              className="field !w-auto"
              aria-label={id.status}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">{id.allStatus}</option>
              <option value="ACTIVE">{id.active}</option>
              <option value="INACTIVE">{id.inactive}</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className="empty-state" role="status">
            <Loader2 size={25} className="animate-spin" />
            <p>{id.loading}</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>{id.error}</h3>
            <p>{error}</p>
            <Button variant="outline" className="mt-4" onClick={refresh}>
              {id.retry}
            </Button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>{id.name} Company</th>
                  <th>{id.industry}</th>
                  <th>{id.city}</th>
                  <th>{id.currency}</th>
                  <th>{id.status}</th>
                  <th>{id.role}</th>
                  <th>{id.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        onClick={() => setSelected(c)}
                        className="flex items-center gap-3 text-left"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-[10px] font-semibold text-primary">
                          {c.code}
                        </span>
                        <span className="font-medium text-slate-700">
                          {c.name}
                          {company.id === c.id && (
                            <span className="mt-1 block text-[9px] font-normal text-primary">
                              {id.activeCompany}
                            </span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td>{c.industry}</td>
                    <td>{c.city}</td>
                    <td>{c.currency}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      <span className="rounded bg-muted px-2 py-1 text-[9px]">
                        {c.role}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={c.id === company.id}
                          onClick={() => switchCompany(c.id)}
                        >
                          {c.id === company.id ? (
                            <Check size={13} />
                          ) : (
                            <ArrowRight size={13} />
                          )}
                          {c.id === company.id ? id.activeCompany : id.apply}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={`${id.actions} ${c.name}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setSelected(c)}>
                              <Pencil />
                              {c.role === "ADMIN" ? id.edit : id.viewProfile}
                            </DropdownMenuItem>
                            {c.status === "ACTIVE" ? (
                              <DropdownMenuItem
                                disabled={c.role !== "ADMIN"}
                                className="text-red-600"
                                onSelect={() => {
                                  setArchiving(c);
                                  setArchiveError("");
                                }}
                              >
                                <Archive />
                                {id.archiveCompany}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={c.role !== "ADMIN"}
                                onSelect={() => activate(c)}
                              >
                                <RotateCcw />
                                {id.reactivate}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="empty-state">
                <Building2 size={28} />
                <h3>{id.empty}</h3>
                <p>{id.emptyHint}</p>
              </div>
            )}
          </div>
        )}
      </section>
      <CompanyForm
        key={typeof selected === "object" ? selected?.id : "new"}
        profile={typeof selected === "object" ? selected : null}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
      <Dialog
        open={!!archiving}
        onOpenChange={(value) => !value && !busy && setArchiving(null)}
      >
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-semibold">
            {id.archiveCompanyTitle}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-muted-foreground">
            {archiving?.name}
            <br />
            {id.archiveCompanyHint}
          </DialogDescription>
          {archiveError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-xs text-red-700"
            >
              {archiveError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setArchiving(null)}
            >
              {id.cancel}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={archive}>
              {busy && <Loader2 className="animate-spin" />}
              {id.archiveCompany}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function CompanyForm({
  profile,
  open,
  onClose,
}: {
  profile: Company | null;
  open: boolean;
  onClose: () => void;
}) {
  const { saveCompany, companies } = useWorkspace();
  const writable = profile
    ? profile.role === "ADMIN"
    : companies.some((c) => c.role === "ADMIN");
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof companySchema>, unknown, CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: profile || {
      code: "",
      name: "",
      industry: "",
      city: "",
      currency: "IDR",
      status: "ACTIVE",
      address: "",
      email: "",
      phone: "",
      taxId: "",
    },
  });
  async function submit(values: CompanyInput) {
    setFormError("");
    try {
      await saveCompany(values, profile?.id, profile?.updatedAt);
      onClose();
    } catch (error) {
      setFormError((error as Error).message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="text-lg font-semibold">
          {profile
            ? writable
              ? id.editRecord("Company")
              : id.companyInfo
            : id.addRecord("Company")}
        </DialogTitle>
        <DialogDescription className="-mt-3 text-xs text-muted-foreground">
          {profile ? profile.name : id.formHint}
        </DialogDescription>
        {!writable && (
          <div className="notice">
            <Info size={15} className="shrink-0" />
            {id.profileReadOnly}
          </div>
        )}
        <form className="space-y-5" onSubmit={handleSubmit(submit)}>
          <fieldset disabled={!writable || isSubmitting} className="space-y-5">
            <legend className="mb-4 text-xs font-semibold">
              {id.recordInfo}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="company-code" className="field-label">
                  {id.code} Company *
                </label>
                <input
                  id="company-code"
                  className="field uppercase read-only:bg-muted"
                  readOnly={!!profile}
                  aria-invalid={!!errors.code}
                  {...register("code")}
                />
                {errors.code && (
                  <span className="field-error" role="alert">
                    {errors.code.message}
                  </span>
                )}
                <p className="mt-1.5 text-[9px] leading-4 text-muted-foreground">
                  {id.companyCodeHint}
                </p>
              </div>
              <div>
                <label htmlFor="company-currency" className="field-label">
                  {id.currency} *
                </label>
                {profile?.currencyLocked ? (
                  <input
                    id="company-currency"
                    readOnly
                    className="field bg-muted"
                    {...register("currency")}
                  />
                ) : (
                  <select
                    id="company-currency"
                    className="field"
                    {...register("currency")}
                  >
                    {currencies.map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                )}
                <p className="mt-1.5 text-[9px] leading-4 text-muted-foreground">
                  {profile?.currencyLocked
                    ? id.currencyLocked
                    : id.companyCurrencyHint}
                </p>
              </div>
            </div>
            {(["name", "industry", "city"] as const).map((name) => (
              <div key={name}>
                <label className="field-label" htmlFor={`company-${name}`}>
                  {name === "name" ? `${id.name} Company` : id[name]} *
                </label>
                <input
                  id={`company-${name}`}
                  className="field"
                  aria-invalid={!!errors[name]}
                  {...register(name)}
                />
                {errors[name] && (
                  <span role="alert" className="field-error">
                    {errors[name]?.message}
                  </span>
                )}
              </div>
            ))}
            <h3 className="border-t pt-4 text-xs font-semibold">
              {id.contactInfo}
            </h3>
            <div>
              <label className="field-label" htmlFor="company-address">
                {id.address}
              </label>
              <textarea
                id="company-address"
                className="field"
                {...register("address")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="company-email">
                  {id.email}
                </label>
                <input
                  id="company-email"
                  type="email"
                  className="field"
                  {...register("email")}
                />
                {errors.email && (
                  <span className="field-error" role="alert">
                    {errors.email.message}
                  </span>
                )}
              </div>
              <div>
                <label className="field-label" htmlFor="company-phone">
                  {id.phone}
                </label>
                <input
                  id="company-phone"
                  className="field"
                  type="tel"
                  {...register("phone")}
                />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="company-taxId">
                {id.taxId}
              </label>
              <input
                id="company-taxId"
                className="field"
                {...register("taxId")}
              />
            </div>
          </fieldset>
          {formError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-700"
            >
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t pt-5">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {id.cancel}
            </Button>
            {writable && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {profile ? id.saveChanges : id.save}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
