import { z } from "zod";

export const masterKinds = [
  "branches",
  "departments",
  "items",
  "customers",
  "suppliers",
  "warehouses",
] as const;
export type MasterKind = (typeof masterKinds)[number];
export const units = ["pcs", "box", "kg", "m", "liter", "set", "unit"] as const;
export const currencies = ["IDR", "USD", "SGD", "EUR"] as const;
export const contactEmail = z
  .union([z.literal(""), z.email("Format email tidak valid")])
  .default("");
const price = z
  .number({ error: "Masukkan angka yang valid" })
  .nonnegative("Nilai tidak boleh negatif")
  .max(1e12, "Nilai terlalu besar")
  .multipleOf(0.01, "Gunakan maksimal 2 angka desimal");
export const masterSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Kode minimal 2 karakter")
    .max(30, "Kode maksimal 30 karakter")
    .regex(/^[A-Za-z0-9-]+$/, "Gunakan huruf, angka, atau tanda -"),
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(120),
  category: z.string().trim().min(1, "Pilih kategori").max(80),
  email: contactEmail,
  phone: z.string().trim().max(30).default(""),
  description: z.string().trim().max(1000).default(""),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(80).optional(),
  taxId: z.string().trim().max(40).optional(),
  branchId: z.string().max(80).optional(),
  costCenter: z.string().trim().max(40).optional(),
  unit: z.enum(units, { error: "Pilih satuan yang valid" }).optional(),
  barcode: z.string().trim().max(60).optional(),
  purchasePrice: price.optional(),
  sellingPrice: price.optional(),
  trackStock: z.boolean().optional(),
  reorderLevel: z
    .number({ error: "Masukkan angka yang valid" })
    .int("Gunakan bilangan bulat")
    .min(0)
    .max(1e9)
    .optional(),
  creditLimit: price.optional(),
  paymentTermsDays: z
    .number({ error: "Masukkan angka yang valid" })
    .int("Gunakan bilangan bulat")
    .min(0)
    .max(365, "Maksimal 365 hari")
    .optional(),
});
export type MasterInput = z.output<typeof masterSchema>;
export type MasterFormInput = z.input<typeof masterSchema>;
export interface MasterRecord extends MasterInput {
  id: string;
  companyId: string;
  createdAt: string;
  updatedAt?: string;
  branchName?: string;
}
export function masterSchemaFor(kind: MasterKind) {
  return masterSchema.superRefine((value, ctx) => {
    if (["departments", "warehouses"].includes(kind) && !value.branchId)
      ctx.addIssue({
        code: "custom",
        path: ["branchId"],
        message: "Pilih Branch untuk data ini",
      });
    if (kind === "branches" && (!value.city || value.city.length < 2))
      ctx.addIssue({
        code: "custom",
        path: ["city"],
        message: "Kota minimal 2 karakter",
      });
    if (
      kind === "items" &&
      value.trackStock === false &&
      (value.reorderLevel || 0) > 0
    )
      ctx.addIssue({
        code: "custom",
        path: ["reorderLevel"],
        message: "Stock minimum harus 0 untuk Items tanpa pelacakan Stock",
      });
  });
}
export function domainDefaults(kind: MasterKind): Partial<MasterInput> {
  switch (kind) {
    case "branches":
      return { city: "", address: "" };
    case "departments":
      return { branchId: "", costCenter: "" };
    case "warehouses":
      return { branchId: "", address: "" };
    case "items":
      return {
        unit: "pcs",
        barcode: "",
        purchasePrice: 0,
        sellingPrice: 0,
        trackStock: true,
        reorderLevel: 0,
      };
    case "customers":
      return { city: "", address: "", taxId: "", creditLimit: 0 };
    case "suppliers":
      return { city: "", address: "", taxId: "", paymentTermsDays: 30 };
  }
}
export function normalizeMasterInput(
  kind: MasterKind,
  input: unknown,
): MasterInput {
  const common = masterSchema.parse(input);
  return masterSchemaFor(kind).parse({
    ...domainDefaults(kind),
    ...common,
    code: common.code.toUpperCase(),
  });
}
export const companySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Kode minimal 2 karakter")
    .max(10, "Kode maksimal 10 karakter")
    .regex(/^[A-Z0-9]+$/, "Gunakan huruf dan angka untuk kode Company"),
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(120),
  industry: z.string().trim().min(3, "Industri minimal 3 karakter").max(100),
  city: z.string().trim().min(2, "Kota minimal 2 karakter").max(80),
  currency: z.enum(currencies, { error: "Pilih mata uang yang tersedia" }),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  address: z.string().trim().max(500).default(""),
  email: contactEmail,
  phone: z.string().trim().max(30).default(""),
  taxId: z.string().trim().max(40).default(""),
});
export type CompanyInput = z.output<typeof companySchema>;
export const versionSchema = z.object({
  expectedUpdatedAt: z.iso.datetime().optional(),
});
export const catalogQuerySchema = z.object({
  branchId: z.string().min(1).max(100).optional(),
  q: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  category: z.string().max(80).default("ALL"),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sort: z
    .enum(["code", "name", "category", "status", "createdAt", "updatedAt"])
    .default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
export type CatalogQuery = z.output<typeof catalogQuerySchema>;
export type PageResult<T> = {
  data: T[];
  meta: { total: number; page: number; pageSize: number; pageCount: number };
};
export type CatalogSummary = Record<
  MasterKind,
  { total: number; active: number; inactive: number }
>;
export type CatalogSearchHit = Pick<MasterRecord, "id" | "code" | "name"> & {
  kind: MasterKind;
};
export const emptyCatalogSummary = (): CatalogSummary =>
  Object.fromEntries(
    masterKinds.map((kind) => [kind, { total: 0, active: 0, inactive: 0 }]),
  ) as CatalogSummary;
