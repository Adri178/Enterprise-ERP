-- AlterTable
BEGIN;

ALTER TABLE "Company" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "taxId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "MasterKind" NOT NULL DEFAULT 'branches',
    "city" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "MasterKind" NOT NULL DEFAULT 'departments',
    "branchId" TEXT,
    "costCenter" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "MasterKind" NOT NULL DEFAULT 'items',
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "barcode" TEXT NOT NULL DEFAULT '',
    "purchasePrice" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "sellingPrice" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "MasterKind" NOT NULL DEFAULT 'customers',
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "creditLimit" DECIMAL(20,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "MasterKind" NOT NULL DEFAULT 'suppliers',
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "MasterKind" NOT NULL DEFAULT 'warehouses',
    "branchId" TEXT,
    "address" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_id_key" ON "Branch"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_id_kind_key" ON "Branch"("companyId", "id", "kind");

-- CreateIndex
CREATE INDEX "Department_companyId_branchId_idx" ON "Department"("companyId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_companyId_id_kind_key" ON "Department"("companyId", "id", "kind");

-- CreateIndex
CREATE INDEX "Item_companyId_idx" ON "Item"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_companyId_id_kind_key" ON "Item"("companyId", "id", "kind");

-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_id_kind_key" ON "Customer"("companyId", "id", "kind");

-- CreateIndex
CREATE INDEX "Supplier_companyId_idx" ON "Supplier"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_companyId_id_kind_key" ON "Supplier"("companyId", "id", "kind");

-- CreateIndex
CREATE INDEX "Warehouse_companyId_branchId_idx" ON "Warehouse"("companyId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_companyId_id_kind_key" ON "Warehouse"("companyId", "id", "kind");

-- CreateIndex
CREATE INDEX "MasterRecord_companyId_kind_name_idx" ON "MasterRecord"("companyId", "kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MasterRecord_companyId_id_kind_key" ON "MasterRecord"("companyId", "id", "kind");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_id_kind_fkey" FOREIGN KEY ("companyId", "id", "kind") REFERENCES "MasterRecord"("companyId", "id", "kind") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_id_kind_fkey" FOREIGN KEY ("companyId", "id", "kind") REFERENCES "MasterRecord"("companyId", "id", "kind") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_branchId_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "Branch"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_companyId_id_kind_fkey" FOREIGN KEY ("companyId", "id", "kind") REFERENCES "MasterRecord"("companyId", "id", "kind") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_id_kind_fkey" FOREIGN KEY ("companyId", "id", "kind") REFERENCES "MasterRecord"("companyId", "id", "kind") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_id_kind_fkey" FOREIGN KEY ("companyId", "id", "kind") REFERENCES "MasterRecord"("companyId", "id", "kind") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_id_kind_fkey" FOREIGN KEY ("companyId", "id", "kind") REFERENCES "MasterRecord"("companyId", "id", "kind") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_branchId_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "Branch"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A profile cannot impersonate another domain even through a direct SQL write.
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_kind_check" CHECK ("kind" = 'branches');
ALTER TABLE "Department" ADD CONSTRAINT "Department_kind_check" CHECK ("kind" = 'departments');
ALTER TABLE "Item" ADD CONSTRAINT "Item_kind_check" CHECK ("kind" = 'items'),
  ADD CONSTRAINT "Item_values_check" CHECK ("purchasePrice" >= 0 AND "sellingPrice" >= 0 AND "reorderLevel" >= 0 AND ("trackStock" OR "reorderLevel" = 0)),
  ADD CONSTRAINT "Item_unit_check" CHECK ("unit" IN ('pcs', 'box', 'kg', 'm', 'liter', 'set', 'unit'));
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_kind_check" CHECK ("kind" = 'customers'), ADD CONSTRAINT "Customer_credit_check" CHECK ("creditLimit" >= 0);
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_kind_check" CHECK ("kind" = 'suppliers'), ADD CONSTRAINT "Supplier_terms_check" CHECK ("paymentTermsDays" BETWEEN 0 AND 365);
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_kind_check" CHECK ("kind" = 'warehouses');

-- Backfill typed profiles while preserving all existing catalog IDs and fields.
INSERT INTO "Branch" ("id", "companyId", "kind", "city")
  SELECT r."id", r."companyId", r."kind", c."city" FROM "MasterRecord" r JOIN "Company" c ON c."id" = r."companyId" WHERE r."kind" = 'branches';
INSERT INTO "Department" ("id", "companyId", "kind", "branchId")
  SELECT r."id", r."companyId", r."kind", (SELECT b."id" FROM "Branch" b WHERE b."companyId" = r."companyId" ORDER BY b."id" LIMIT 1) FROM "MasterRecord" r WHERE r."kind" = 'departments';
INSERT INTO "Warehouse" ("id", "companyId", "kind", "branchId")
  SELECT r."id", r."companyId", r."kind", (SELECT b."id" FROM "Branch" b WHERE b."companyId" = r."companyId" ORDER BY b."id" LIMIT 1) FROM "MasterRecord" r WHERE r."kind" = 'warehouses';
INSERT INTO "Item" ("id", "companyId", "kind") SELECT "id", "companyId", "kind" FROM "MasterRecord" WHERE "kind" = 'items';
INSERT INTO "Customer" ("id", "companyId", "kind") SELECT "id", "companyId", "kind" FROM "MasterRecord" WHERE "kind" = 'customers';
INSERT INTO "Supplier" ("id", "companyId", "kind") SELECT "id", "companyId", "kind" FROM "MasterRecord" WHERE "kind" = 'suppliers';

COMMIT;

