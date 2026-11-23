import "reflect-metadata";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { ProcurementService } from "../apps/api/dist/procurement/procurement.service.js";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("Development seed only");
const prisma = new PrismaClient(),
  service = new ProcurementService(prisma);
try {
  const actor = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@enterprise.local" },
  });
  for (const fixture of [
    {
      companyId: "alpha",
      key: "5022c7d9-4fc8-4905-9e00-a1fa00000001",
      stage: "PENDING",
      date: "2026-10-20",
      quantity: 12,
      price: 1250000,
    },
    {
      companyId: "alpha",
      key: "5022c7d9-4fc8-4905-9e00-a1fa00000002",
      stage: "PURCHASE_INVOICE",
      date: "2026-10-18",
      quantity: 8,
      price: 925000,
    },
    {
      companyId: "beta",
      key: "5022c7d9-4fc8-4905-9e00-befa00000001",
      stage: "PURCHASE_RECEIPT",
      date: "2026-10-19",
      quantity: 25,
      price: 340000,
    },
  ]) {
    if (
      (await prisma.company.findUnique({ where: { id: fixture.companyId } }))
        ?.status !== "ACTIVE"
    )
      continue;
    // Never overwrite or advance documents that users have already reviewed.
    if (
      await prisma.purchaseDocument.findUnique({
        where: {
          companyId_requestKey: {
            companyId: fixture.companyId,
            requestKey: fixture.key,
          },
        },
      })
    )
      continue;
    const supplier = await prisma.supplier.findFirst({
      where: { companyId: fixture.companyId, record: { status: "ACTIVE" } },
      orderBy: { id: "asc" },
    });
    const warehouse = await prisma.warehouse.findFirst({
      where: { companyId: fixture.companyId, record: { status: "ACTIVE" } },
      orderBy: { id: "asc" },
    });
    const item = await prisma.item.findFirst({
      where: {
        companyId: fixture.companyId,
        trackStock: true,
        record: { status: "ACTIVE" },
      },
      orderBy: { id: "asc" },
    });
    if (!supplier || !warehouse || !item) continue;
    let document = await service.createRequest(fixture.companyId, actor.id, {
      requestKey: fixture.key,
      date: fixture.date,
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      description:
        "Fixture pengembangan: transaksi fiktif untuk demonstrasi Workflow.",
      lines: [
        {
          itemId: item.id,
          quantity: fixture.quantity,
          unitPrice: fixture.price,
        },
      ],
    });
    const action = async (name) => {
      document = await service.action(
        fixture.companyId,
        actor.id,
        document.id,
        { action: name, expectedUpdatedAt: document.updatedAt.toISOString() },
      );
    };
    await action("submit");
    if (fixture.stage === "PENDING") continue;
    await action("approve");
    for (const [index, kind] of [
      "PURCHASE_ORDER",
      "PURCHASE_RECEIPT",
      "PURCHASE_INVOICE",
    ].entries()) {
      document = await service.createFromSource(fixture.companyId, actor.id, {
        requestKey: fixture.key.slice(0, -1) + String(index + 3),
        date: fixture.date,
        sourceId: document.id,
        kind,
        description: "Fixture pengembangan",
      });
      await action("post");
      if (kind === fixture.stage) break;
    }
  }
  console.log(
    "Development Procurement fixtures ready; existing workflow documents preserved.",
  );
} finally {
  await prisma.$disconnect();
}
