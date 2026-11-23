import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
type Tx = Prisma.TransactionClient;
export async function assertStockDate(
  tx: Tx,
  companyId: string,
  itemId: string,
  warehouseIds: string[],
  date: Date,
) {
  const latest = await tx.stockLedger.findFirst({
    where: { companyId, itemId, warehouseId: { in: warehouseIds } },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (latest && latest.date > date)
    throw new ConflictException(
      "Tanggal Stock tidak boleh mendahului pergerakan terakhir untuk Items dan Warehouse ini.",
    );
}
export function outgoingStockCost(
  balance: { quantity: number; value: Prisma.Decimal } | null,
  quantity: number,
) {
  if (!balance || quantity <= 0 || balance.quantity < quantity)
    throw new ConflictException(
      "Stock tidak mencukupi. Muat ulang saldo sebelum membukukan dokumen.",
    );
  return {
    unitPrice: balance.value
      .div(balance.quantity)
      .toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP),
    value:
      quantity === balance.quantity
        ? balance.value
        : balance.value
            .mul(quantity)
            .div(balance.quantity)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
  };
}
// Called only inside the caller's Serializable transaction. Every balance change has a ledger row.
export async function postStockMovement(
  tx: Tx,
  input: {
    companyId: string;
    itemId: string;
    warehouseId: string;
    quantity: number;
    value: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    date: Date;
  } & (
    | { documentId: string; operationId?: never; salesDocumentId?: never; workOrderId?: never }
    | { operationId: string; documentId?: never; salesDocumentId?: never; workOrderId?: never }
    | { salesDocumentId: string; documentId?: never; operationId?: never; workOrderId?: never }
    | { workOrderId: string; documentId?: never; operationId?: never; salesDocumentId?: never }
  ),
) {
  const { companyId, itemId, warehouseId } = input;
  const key = { companyId, itemId, warehouseId };
  const balance = await tx.stockBalance.findUnique({
    where: { companyId_itemId_warehouseId: key },
  });
  const quantity = (balance?.quantity || 0) + input.quantity,
    value = (balance?.value || new Prisma.Decimal(0)).add(input.value);
  if (quantity < 0 || value.lt(0))
    throw new ConflictException("Stock tidak mencukupi untuk perubahan ini.");
  if (quantity > 2000000000 || value.gt("90000000000000"))
    throw new ConflictException("Saldo Stock melebihi batas yang didukung.");
  if (quantity === 0 && !value.eq(0))
    throw new ConflictException(
      "Nilai saldo tidak konsisten. Periksa Stock ledger.",
    );
  await tx.stockLedger.create({ data: input });
  if (balance)
    await tx.stockBalance.update({
      where: { companyId_itemId_warehouseId: key },
      data: {
        quantity: { increment: input.quantity },
        value: { increment: input.value },
      },
    });
  else
    await tx.stockBalance.create({
      data: { ...key, quantity: input.quantity, value: input.value },
    });
}
