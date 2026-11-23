import type {
  Branch,
  Department,
  Item,
  Customer,
  Supplier,
  Warehouse,
  MasterRecord as DbMasterRecord,
  Prisma,
} from "@prisma/client";
import type { MasterInput, MasterKind, MasterRecord } from "@erp/shared";

export const domainIncludes = {
  branches: { branch: true },
  departments: {
    department: {
      include: { branch: { include: { record: { select: { name: true } } } } },
    },
  },
  items: { item: true },
  customers: { customer: true },
  suppliers: { supplier: true },
  warehouses: {
    warehouse: {
      include: { branch: { include: { record: { select: { name: true } } } } },
    },
  },
} as const satisfies Record<MasterKind, Prisma.MasterRecordInclude>;
type BranchLabel = { branch?: { record: { name: string } } | null };
type DomainRecord = DbMasterRecord & {
  branch?: Branch | null;
  department?: (Department & BranchLabel) | null;
  item?: Item | null;
  customer?: Customer | null;
  supplier?: Supplier | null;
  warehouse?: (Warehouse & BranchLabel) | null;
};
export function serializeRecord(row: DomainRecord): MasterRecord {
  const {
    branch,
    department,
    item,
    customer,
    supplier,
    warehouse,
    createdAt,
    updatedAt,
    ...base
  } = row;
  return {
    ...base,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    ...(branch ? { city: branch.city, address: branch.address } : {}),
    ...(department
      ? {
          branchId: department.branchId || "",
          branchName: department.branch?.record.name,
          costCenter: department.costCenter,
        }
      : {}),
    ...(warehouse
      ? {
          branchId: warehouse.branchId || "",
          branchName: warehouse.branch?.record.name,
          address: warehouse.address,
        }
      : {}),
    ...(item
      ? {
          unit: item.unit as MasterInput["unit"],
          barcode: item.barcode,
          purchasePrice: item.purchasePrice.toNumber(),
          sellingPrice: item.sellingPrice.toNumber(),
          trackStock: item.trackStock,
          reorderLevel: item.reorderLevel,
        }
      : {}),
    ...(customer
      ? {
          city: customer.city,
          address: customer.address,
          taxId: customer.taxId,
          creditLimit: customer.creditLimit.toNumber(),
        }
      : {}),
    ...(supplier
      ? {
          city: supplier.city,
          address: supplier.address,
          taxId: supplier.taxId,
          paymentTermsDays: supplier.paymentTermsDays,
        }
      : {}),
  };
}
export function baseInput(input: MasterInput) {
  const { code, name, category, email, phone, description, status } = input;
  return { code, name, category, email, phone, description, status };
}
export async function saveDomain(
  tx: Prisma.TransactionClient,
  companyId: string,
  kind: MasterKind,
  id: string,
  input: MasterInput,
  preserveExisting = false,
) {
  const identity = { id, companyId };
  switch (kind) {
    case "branches": {
      const data = { city: input.city || "", address: input.address || "" };
      await tx.branch.upsert({
        where: { id },
        create: { ...identity, ...data },
        update: preserveExisting ? {} : data,
      });
      break;
    }
    case "departments": {
      const data = {
        branchId: input.branchId || null,
        costCenter: input.costCenter || "",
      };
      await tx.department.upsert({
        where: { id },
        create: { ...identity, ...data },
        update: preserveExisting ? {} : data,
      });
      break;
    }
    case "warehouses": {
      const data = {
        branchId: input.branchId || null,
        address: input.address || "",
      };
      await tx.warehouse.upsert({
        where: { id },
        create: { ...identity, ...data },
        update: preserveExisting ? {} : data,
      });
      break;
    }
    case "items": {
      const data = {
        unit: input.unit || "pcs",
        barcode: input.barcode || "",
        purchasePrice: input.purchasePrice || 0,
        sellingPrice: input.sellingPrice || 0,
        trackStock: input.trackStock ?? true,
        reorderLevel: input.reorderLevel || 0,
      };
      await tx.item.upsert({
        where: { id },
        create: { ...identity, ...data },
        update: preserveExisting ? {} : data,
      });
      break;
    }
    case "customers": {
      const data = {
        city: input.city || "",
        address: input.address || "",
        taxId: input.taxId || "",
        creditLimit: input.creditLimit || 0,
      };
      await tx.customer.upsert({
        where: { id },
        create: { ...identity, ...data },
        update: preserveExisting ? {} : data,
      });
      break;
    }
    case "suppliers": {
      const data = {
        city: input.city || "",
        address: input.address || "",
        taxId: input.taxId || "",
        paymentTermsDays: input.paymentTermsDays ?? 30,
      };
      await tx.supplier.upsert({
        where: { id },
        create: { ...identity, ...data },
        update: preserveExisting ? {} : data,
      });
      break;
    }
  }
}
