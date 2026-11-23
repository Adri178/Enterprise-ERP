import "reflect-metadata";
import { config } from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import { SalesService } from "../apps/api/dist/sales/sales.service.js";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("Development seed only");
const prisma = new PrismaClient(),
  service = new SalesService(prisma);
try {
  const actor = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@enterprise.local" },
  });
  for (const fixture of [
    {
      companyId: "alpha",
      key: "5a1e2026-1021-4678-9234-a1fa00000001",
      paid: false,
    },
    {
      companyId: "beta",
      key: "5a1e2026-1021-4678-9234-befa00000001",
      paid: true,
    },
  ]) {
    if (
      (await prisma.company.findUnique({ where: { id: fixture.companyId } }))
        ?.status !== "ACTIVE"
    )
      continue;
    if (
      await prisma.salesDocument.findUnique({
        where: {
          companyId_requestKey: {
            companyId: fixture.companyId,
            requestKey: fixture.key,
          },
        },
      })
    )
      continue;
    const balance = await prisma.stockBalance.findFirst({
      where: {
        companyId: fixture.companyId,
        quantity: { gte: 2 },
        item: { trackStock: true, record: { status: "ACTIVE" } },
        warehouse: { record: { status: "ACTIVE" } },
      },
      include: { item: true },
      orderBy: { id: "asc" },
    });
    if (!balance) continue;
    const unitPrice = balance.item.sellingPrice.gt(0)
      ? balance.item.sellingPrice
      : balance.value.div(balance.quantity).mul("1.2").toDecimalPlaces(2);
    if (unitPrice.lte(0) || unitPrice.gt(1e10)) continue;
    const amount = unitPrice.mul(2);
    const customers = await prisma.customer.findMany({
      where: { companyId: fixture.companyId, record: { status: "ACTIVE" } },
      orderBy: { id: "asc" },
      take: 20,
    });
    let customer;
    for (const candidate of customers) {
      const totals = await prisma.salesDocument.groupBy({
        by: ["kind"],
        where: {
          companyId: fixture.companyId,
          customerId: candidate.id,
          status: "POSTED",
          kind: { in: ["SALES_INVOICE", "PAYMENT"] },
        },
        _sum: { amount: true },
      });
      const total = (kind) =>
        totals.find((t) => t.kind === kind)?._sum.amount ||
        new Prisma.Decimal(0);
      if (
        candidate.creditLimit.eq(0) ||
        total("SALES_INVOICE")
          .sub(total("PAYMENT"))
          .add(amount)
          .lte(candidate.creditLimit)
      ) {
        customer = candidate;
        break;
      }
    }
    if (!customer) continue;
    const latest = await prisma.stockLedger.findFirst({
      where: {
        companyId: fixture.companyId,
        itemId: balance.itemId,
        warehouseId: balance.warehouseId,
      },
      orderBy: { date: "desc" },
    });
    const date = [
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }),
      latest?.date.toISOString().slice(0, 10) || "",
    ]
      .sort()
      .at(-1);
    let doc = await service.create(fixture.companyId, actor.id, {
      requestKey: fixture.key,
      date,
      customerId: customer.id,
      warehouseId: balance.warehouseId,
      description: "Fixture pengembangan: transaksi Sales fiktif.",
      lines: [
        {
          itemId: balance.itemId,
          quantity: 2,
          unitPrice: unitPrice.toNumber(),
        },
      ],
    });
    const post = async () => {
      doc = await service.action(fixture.companyId, actor.id, doc.id, {
        action: "post",
        expectedUpdatedAt: new Date(doc.updatedAt).toISOString(),
      });
    };
    await post();
    for (const [index, kind] of [
      "SALES_ORDER",
      "DELIVERY_NOTE",
      "SALES_INVOICE",
      ...(fixture.paid ? ["PAYMENT"] : []),
    ].entries()) {
      doc = await service.fromSource(fixture.companyId, actor.id, {
        requestKey: fixture.key.slice(0, -1) + String(index + 2),
        sourceId: doc.id,
        kind,
        date,
        description: "Fixture pengembangan",
      });
      await post();
    }
  }
  console.log(
    "Sales development fixtures ready; existing documents preserved. Missing eligible Stock/credit is skipped.",
  );
} finally {
  await prisma.$disconnect();
}
