"use client";
import { useState } from "react";
import {
  useForm,
  useWatch,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  domainDefaults,
  masterSchemaFor,
  units,
  type MasterInput,
  type MasterFormInput,
  type MasterKind,
  type MasterRecord,
} from "@erp/shared";
import { Info, Loader2 } from "lucide-react";
import { id } from "@/lib/i18n";
import { categories } from "@/lib/demo-data";
import { useWorkspace } from "./workspace-provider";
import { BranchSelect } from "./branch-select";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

export const masterLabels: Record<MasterKind, string> = {
  branches: "Branch",
  departments: "Department",
  items: "Items",
  customers: "Customer",
  suppliers: "Supplier",
  warehouses: "Warehouse",
};
export function MasterForm({
  kind,
  record,
  open,
  onClose,
}: {
  kind: MasterKind;
  record: MasterRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  const { company, saveRecord, writable } = useWorkspace();
  const label = masterLabels[kind];
  const [formError, setFormError] = useState("");
  const [branchName, setBranchName] = useState(record?.branchName || "");
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MasterFormInput, unknown, MasterInput>({
    resolver: zodResolver(masterSchemaFor(kind)),
    defaultValues: {
      code: "",
      name: "",
      category: categories[kind][0],
      status: "ACTIVE",
      email: "",
      phone: "",
      description: "",
      ...domainDefaults(kind),
      ...(kind === "branches" ? { city: company.city } : {}),
      ...record,
    },
  });
  const field = { register, errors };
  const tracksStock = useWatch({ control, name: "trackStock" });
  const branchId = useWatch({ control, name: "branchId" });
  async function submit(values: MasterInput) {
    setFormError("");
    try {
      await saveRecord(kind, values, record?.id, record?.updatedAt);
      onClose();
    } catch (error) {
      setFormError((error as Error).message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="text-lg font-semibold">
          {record
            ? writable
              ? id.editRecord(label)
              : `${id.recordInfo} ${label}`
            : id.addRecord(label)}
        </DialogTitle>
        <DialogDescription className="-mt-3 text-xs text-muted-foreground">
          {id.formHint}
        </DialogDescription>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3 text-xs">
          <span className="text-muted-foreground">{id.activeCompany}</span>
          <strong className="truncate font-medium">{company.name}</strong>
        </div>
        <form onSubmit={handleSubmit(submit)} className="space-y-5">
          <fieldset disabled={!writable || isSubmitting} className="space-y-5">
            <legend className="mb-4 text-xs font-semibold">
              {id.recordInfo}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <MasterField
                {...field}
                name="code"
                label={`${id.code} ${label}`}
                required
              />
              <div>
                <label className="field-label" htmlFor="record-status">
                  {id.status}
                </label>
                <select
                  id="record-status"
                  className="field"
                  {...register("status")}
                >
                  <option value="ACTIVE">{id.active}</option>
                  <option value="INACTIVE">{id.inactive}</option>
                </select>
              </div>
            </div>
            <MasterField
              {...field}
              name="name"
              label={`${id.name} ${label}`}
              required
            />
            <div>
              <label className="field-label" htmlFor="record-category">
                {id.category} *
              </label>
              <select
                id="record-category"
                className="field"
                {...register("category")}
              >
                {[
                  ...new Set([
                    ...categories[kind],
                    ...(record?.category ? [record.category] : []),
                  ]),
                ].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
            {["departments", "warehouses"].includes(kind) && (
              <>
                <h3 className="border-t pt-4 text-xs font-semibold">
                  {id.organizationInfo}
                </h3>
                <BranchSelect
                  value={branchId}
                  label={branchName}
                  onChange={(value, name) => {
                    setValue("branchId", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setBranchName(name);
                  }}
                  error={errors.branchId?.message}
                  disabled={!writable || isSubmitting}
                />
                {kind === "departments" && (
                  <MasterField
                    {...field}
                    name="costCenter"
                    label={id.costCenter}
                  />
                )}
              </>
            )}
            {["branches", "customers", "suppliers", "warehouses"].includes(
              kind,
            ) && (
              <>
                <h3 className="border-t pt-4 text-xs font-semibold">
                  {id.contactInfo}
                </h3>
                {kind !== "warehouses" && (
                  <MasterField
                    {...field}
                    name="city"
                    label={id.city}
                    required={kind === "branches"}
                  />
                )}
                <div>
                  <label className="field-label" htmlFor="record-address">
                    {id.address}
                  </label>
                  <textarea
                    id="record-address"
                    className="field"
                    {...register("address")}
                  />
                  <FieldError message={errors.address?.message} />
                </div>
                {kind !== "warehouses" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MasterField
                      {...field}
                      name="email"
                      type="email"
                      label={id.email}
                    />
                    <MasterField
                      {...field}
                      name="phone"
                      type="tel"
                      label={id.phone}
                    />
                  </div>
                )}
              </>
            )}
            {["customers", "suppliers"].includes(kind) && (
              <>
                <h3 className="border-t pt-4 text-xs font-semibold">
                  {id.commercialInfo}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MasterField {...field} name="taxId" label={id.taxId} />
                  {kind === "customers" ? (
                    <MasterField
                      {...field}
                      name="creditLimit"
                      type="number"
                      label={`${id.creditLimit} (${company.currency})`}
                      hint={id.creditLimitHint}
                    />
                  ) : (
                    <MasterField
                      {...field}
                      name="paymentTermsDays"
                      type="number"
                      label={id.paymentTermsDays}
                      integer
                    />
                  )}
                </div>
              </>
            )}
            {kind === "items" && (
              <>
                <h3 className="border-t pt-4 text-xs font-semibold">
                  {id.itemDetails}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor="record-unit">
                      {id.unit} *
                    </label>
                    <select
                      id="record-unit"
                      className="field"
                      {...register("unit")}
                    >
                      {units.map((unit) => (
                        <option key={unit}>{unit}</option>
                      ))}
                    </select>
                    <FieldError message={errors.unit?.message} />
                  </div>
                  <MasterField {...field} name="barcode" label={id.barcode} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MasterField
                    {...field}
                    name="purchasePrice"
                    type="number"
                    label={`${id.purchasePrice} (${company.currency})`}
                  />
                  <MasterField
                    {...field}
                    name="sellingPrice"
                    type="number"
                    label={`${id.sellingPrice} (${company.currency})`}
                  />
                </div>
                <label className="flex items-start gap-3 rounded-lg border p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-primary"
                    {...register("trackStock", {
                      onChange: (event) => {
                        if (!event.target.checked)
                          setValue("reorderLevel", 0, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                      },
                    })}
                  />
                  <span>
                    <strong className="block text-xs font-medium">
                      {id.trackStock}
                    </strong>
                    <span className="mt-1 block text-[10px] leading-5 text-muted-foreground">
                      {id.trackStockHint}
                    </span>
                  </span>
                </label>
                <MasterField
                  {...field}
                  name="reorderLevel"
                  type="number"
                  label={id.stockMinimum}
                  integer
                  readOnly={!tracksStock}
                />
                <div className="notice">
                  <Info size={14} className="shrink-0" />
                  {id.stockHint}
                </div>
              </>
            )}
            <div>
              <label className="field-label" htmlFor="record-description">
                {id.description}
              </label>
              <textarea
                id="record-description"
                className="field"
                {...register("description")}
              />
              <FieldError message={errors.description?.message} />
            </div>
          </fieldset>
          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-700"
            >
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {id.cancel}
            </Button>
            {writable && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {record ? id.saveChanges : id.save}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="field-error" role="alert">
      {message}
    </span>
  ) : null;
}
function MasterField({
  register,
  errors,
  name,
  label,
  required,
  type = "text",
  integer,
  readOnly,
  hint,
}: {
  register: UseFormRegister<MasterFormInput>;
  errors: FieldErrors<MasterFormInput>;
  name: keyof MasterFormInput;
  label: string;
  required?: boolean;
  type?: "text" | "email" | "tel" | "number";
  integer?: boolean;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={`record-${name}`}>
        {label}
        {required ? " *" : ""}
      </label>
      <input
        id={`record-${name}`}
        className="field read-only:bg-muted"
        type={type}
        step={type === "number" ? (integer ? "1" : "0.01") : undefined}
        min={type === "number" ? 0 : undefined}
        readOnly={readOnly}
        aria-invalid={!!errors[name]}
        aria-describedby={
          [errors[name] ? `error-${name}` : "", hint ? `hint-${name}` : ""]
            .filter(Boolean)
            .join(" ") || undefined
        }
        {...register(name, { valueAsNumber: type === "number" })}
      />
      {hint && (
        <p
          id={`hint-${name}`}
          className="mt-1 text-[10px] leading-relaxed text-muted-foreground"
        >
          {hint}
        </p>
      )}
      {errors[name]?.message && (
        <span id={`error-${name}`} className="field-error" role="alert">
          {String(errors[name]?.message)}
        </span>
      )}
    </div>
  );
}
