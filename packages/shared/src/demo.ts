import type { Company, MasterKind, MasterRecord, Transaction } from "./index";
import { companySchema, domainDefaults, masterSchema } from "./catalog";
import { z } from "zod";
const companyDefaults = {
  status: "ACTIVE" as const,
  address: "",
  email: "",
  phone: "",
  taxId: "",
};
export const demoCompanies: Company[] = [
  {
    ...companyDefaults,
    id: "alpha",
    code: "ALP",
    name: "PT Alpha Distribusi",
    industry: "Distribusi & Perdagangan",
    city: "Jakarta",
    currency: "IDR",
    role: "ADMIN",
  },
  {
    ...companyDefaults,
    id: "beta",
    code: "BET",
    name: "PT Beta Industri",
    industry: "Manufaktur & Industri",
    city: "Bandung",
    currency: "IDR",
    role: "MANAGER",
  },
  {
    ...companyDefaults,
    id: "gamma",
    code: "GAM",
    name: "PT Gamma Digital",
    industry: "Teknologi & Jasa",
    city: "Surabaya",
    currency: "IDR",
    role: "VIEWER",
  },
];
export type DemoData = {
  companies: Company[];
  records: Record<MasterKind, MasterRecord[]>;
  transactions: Transaction[];
};
const names: Record<MasterKind, [string, string][]> = {
  suppliers: [
    ["PT Sumber Makmur", "Distributor"],
    ["CV Mitra Sejahtera", "Produsen"],
    ["PT Nusantara Logistik", "Jasa"],
    ["PT Karya Sentosa", "Distributor"],
    ["CV Berkah Abadi", "Produsen"],
    ["PT Prima Teknologi", "Jasa"],
    ["PT Sentral Niaga", "Distributor"],
    ["CV Maju Bersama", "Produsen"],
    ["PT Global Material", "Distributor"],
    ["PT Cipta Karya", "Jasa"],
    ["CV Anugerah Jaya", "Distributor"],
    ["PT Indo Persada", "Produsen"],
  ],
  customers: [
    ["PT Cakrawala Retail", "Retail"],
    ["CV Harmoni Utama", "Wholesale"],
    ["PT Bumi Persada", "Corporate"],
    ["PT Lintas Nusantara", "Corporate"],
    ["CV Cemerlang Jaya", "Retail"],
    ["PT Sentosa Group", "Wholesale"],
  ],
  items: [
    ["Kertas A4 Premium 80 gsm", "Alat Tulis"],
    ["Tinta Printer Black 100 ml", "Alat Tulis"],
    ["Karton Box Medium", "Packaging"],
    ["Laptop Business 14 inch", "Elektronik"],
    ["Monitor IPS 24 inch", "Elektronik"],
    ["Meja Kerja Modular", "Furniture"],
    ["Kursi Ergonomis", "Furniture"],
    ["Label Thermal 100 × 150", "Packaging"],
  ],
  branches: [
    ["Kantor Pusat", "Kantor Pusat"],
    ["Branch Jakarta Selatan", "Operasional"],
    ["Branch Tangerang", "Distribusi"],
  ],
  departments: [
    ["Finance & Accounting", "Operasional"],
    ["Sales & Marketing", "Komersial"],
    ["Supply Chain", "Operasional"],
    ["People & Culture", "Pendukung"],
  ],
  warehouses: [
    ["Warehouse Utama", "Pusat"],
    ["Warehouse Distribusi", "Distribusi"],
    ["Warehouse Transit", "Transit"],
  ],
};
export const categories: Record<MasterKind, string[]> = {
  suppliers: ["Distributor", "Produsen", "Jasa"],
  customers: ["Retail", "Wholesale", "Corporate"],
  items: ["Alat Tulis", "Packaging", "Elektronik", "Furniture"],
  branches: ["Kantor Pusat", "Operasional", "Distribusi"],
  departments: ["Operasional", "Komersial", "Pendukung"],
  warehouses: ["Pusat", "Distribusi", "Transit"],
};
export function createDemoData(): DemoData {
  const records = {} as DemoData["records"];
  (Object.keys(names) as MasterKind[]).forEach((kind) => {
    records[kind] = demoCompanies.flatMap((company, c) =>
      names[kind]
        .slice(0, c === 2 ? 4 : undefined)
        .map(([name, category], i) => ({
          id: `${company.id}-${kind}-${i}`,
          companyId: company.id,
          code: `${kind.slice(0, 3).toUpperCase()}-${company.code}-${String(i + 1).padStart(3, "0")}`,
          name: c === 0 ? name : `${name} ${c === 1 ? "Industri" : "Digital"}`,
          category,
          email: ["suppliers", "customers"].includes(kind)
            ? `info@${name.toLowerCase().replace(/[^a-z]/g, "")}.example`
            : "",
          phone: ["suppliers", "customers"].includes(kind)
            ? `021-555-${String(1200 + i)}`
            : "",
          description: "",
          status:
            i === 5 || i === 9 ? ("INACTIVE" as const) : ("ACTIVE" as const),
          createdAt: `2026-10-${String(Math.max(1, 20 - i)).padStart(2, "0")}T03:00:00.000Z`,
        })),
    );
  });
  for (const [kind, rows] of Object.entries(records) as [
    MasterKind,
    MasterRecord[],
  ][]) {
    records[kind] = rows.map((record, index) => ({
      ...domainDefaults(kind),
      ...record,
      ...(kind === "branches" || kind === "customers" || kind === "suppliers"
        ? { city: demoCompanies.find((c) => c.id === record.companyId)!.city }
        : {}),
      ...(["departments", "warehouses"].includes(kind)
        ? {
            branchId: records.branches.find(
              (b) => b.companyId === record.companyId,
            )!.id,
            branchName: records.branches.find(
              (b) => b.companyId === record.companyId,
            )!.name,
          }
        : {}),
      ...(kind === "items"
        ? {
            purchasePrice: [
              45000, 75000, 12500, 8500000, 1800000, 950000, 1250000, 65000,
            ][index % 8],
            sellingPrice: [
              55000, 95000, 18000, 10500000, 2250000, 1200000, 1650000, 85000,
            ][index % 8],
            reorderLevel: 20,
          }
        : {}),
      updatedAt: record.createdAt,
    }));
  }
  const types: Transaction["type"][] = [
    "Sales Invoice",
    "Purchase Order",
    "Sales Order",
    "Purchase Invoice",
    "Payment",
  ];
  const statuses: Transaction["status"][] = [
    "COMPLETED",
    "PENDING",
    "APPROVED",
    "PENDING",
    "COMPLETED",
  ];
  const transactions = demoCompanies.flatMap((company, c) =>
    Array.from({ length: 40 }, (_, i): Transaction => ({
      id: `${["SI", "PO", "SO", "PI", "PAY"][i % 5]}-${company.code}-2026-${String(100 + i).padStart(4, "0")}`,
      companyId: company.id,
      type: types[i % 5],
      party: (i % 5 === 1 || i % 5 === 3 ? names.suppliers : names.customers)[
        i % 6
      ][0],
      amount: Math.round(
        ([48500000, 24750000, 18250000, 32800000, 12750000][i % 5] +
          i * 370000) *
          (1 - c * 0.23),
      ),
      date:
        i < 20
          ? `2026-10-${String(21 - i).padStart(2, "0")}`
          : `2026-09-${String(30 - (i - 20)).padStart(2, "0")}`,
      status: statuses[i % 5],
    })),
  );
  return {
    companies: demoCompanies.map((c) => ({ ...c, currencyLocked: true })),
    records,
    transactions,
  };
}

// Upgrade Phase 1 localStorage in place, preserving user-created catalog rows and drafts.
export function restoreDemoData(value: unknown): DemoData {
  const container = z
    .object({
      companies: z.array(z.unknown()).optional(),
      records: z.record(z.string(), z.array(z.unknown())),
      transactions: z.array(
        z.object({
          id: z.string(),
          companyId: z.string(),
          type: z.enum([
            "Sales Invoice",
            "Purchase Order",
            "Sales Order",
            "Purchase Invoice",
            "Payment",
          ]),
          party: z.string(),
          amount: z.number().nonnegative(),
          date: z.iso.date(),
          status: z.enum(["DRAFT", "PENDING", "APPROVED", "COMPLETED"]),
          description: z.string().optional(),
        }),
      ),
    })
    .parse(value);
  const companies = container.companies
    ? container.companies.map((raw) => {
        const metadata = z
          .object({
            id: z.string(),
            role: z.enum(["ADMIN", "MANAGER", "VIEWER"]),
            updatedAt: z.string().optional(),
          })
          .parse(raw);
        return {
          ...companySchema.parse({ ...companyDefaults, ...(raw as object) }),
          ...metadata,
        };
      })
    : demoCompanies.map((c) => ({ ...c }));
  const records = {} as DemoData["records"];
  for (const kind of Object.keys(domainDefaultsMap) as MasterKind[]) {
    const rows = container.records[kind];
    if (!rows) throw new Error("Data demo tidak lengkap");
    records[kind] = rows.map((raw) => {
      const metadata = z
        .object({
          id: z.string(),
          companyId: z.string(),
          createdAt: z.string(),
          updatedAt: z.string().optional(),
        })
        .parse(raw);
      return {
        ...domainDefaults(kind),
        ...masterSchema.parse(raw),
        ...metadata,
        updatedAt: metadata.updatedAt || metadata.createdAt,
      };
    });
  }
  for (const kind of ["departments", "warehouses"] as const)
    for (const row of records[kind]) {
      const branch =
        records.branches.find(
          (b) => b.companyId === row.companyId && b.id === row.branchId,
        ) || records.branches.find((b) => b.companyId === row.companyId);
      row.branchId = branch?.id || "";
      row.branchName = branch?.name;
    }
  for (const row of records.branches)
    if (!row.city)
      row.city = companies.find((c) => c.id === row.companyId)?.city || "";
  return { companies, records, transactions: container.transactions };
}
const domainDefaultsMap = {
  branches: true,
  departments: true,
  items: true,
  customers: true,
  suppliers: true,
  warehouses: true,
};
