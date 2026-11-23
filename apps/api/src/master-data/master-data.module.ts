import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  catalogQuerySchema,
  emptyCatalogSummary,
  masterKinds,
  masterSchemaFor,
  domainDefaults,
  versionSchema,
  type CatalogQuery,
  type MasterKind,
} from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { CompanyGuard, Roles, type AuthRequest } from "../auth/access";
import { AuthModule } from "../auth/auth.module";
import { validate } from "../common/validation";
import { requireCompanyWrite } from "../auth/write-access";
import {
  baseInput,
  domainIncludes,
  saveDomain,
  serializeRecord,
} from "./domain-records";
const kindSchema = z.enum(masterKinds);
@Injectable()
export class MasterDataService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(companyId: string, kind: MasterKind, query: CatalogQuery) {
    const where: Prisma.MasterRecordWhereInput = {
      companyId,
      kind,
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(query.category !== "ALL" ? { category: query.category } : {}),
      ...(query.branchId && kind === "departments"
        ? { department: { branchId: query.branchId } }
        : {}),
      ...(query.branchId && kind === "warehouses"
        ? { warehouse: { branchId: query.branchId } }
        : {}),
      ...(query.q
        ? {
            OR: ["code", "name", "email"].map((field) => ({
              [field]: { contains: query.q, mode: "insensitive" },
            })),
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.masterRecord.count({ where });
        const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
        const page = Math.min(query.page, pageCount);
        const rows = await tx.masterRecord.findMany({
          where,
          include: domainIncludes[kind],
          orderBy: [{ [query.sort]: query.direction }, { id: "asc" }],
          skip: (page - 1) * query.pageSize,
          take: query.pageSize,
        });
        return {
          data: rows.map(serializeRecord),
          meta: { total, page, pageSize: query.pageSize, pageCount },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async summary(companyId: string) {
    const groups = await this.prisma.masterRecord.groupBy({
      by: ["kind", "status"],
      where: { companyId },
      _count: { _all: true },
    });
    const result = emptyCatalogSummary();
    for (const group of groups) {
      result[group.kind].total += group._count._all;
      result[group.kind][group.status === "ACTIVE" ? "active" : "inactive"] =
        group._count._all;
    }
    return result;
  }
  async search(companyId: string, q: string) {
    if (q.length < 2) return [];
    return this.prisma.masterRecord.findMany({
      where: {
        companyId,
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, code: true, name: true, kind: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 8,
    });
  }
  async detail(companyId: string, kind: MasterKind, id: string) {
    const row = await this.prisma.masterRecord.findFirst({
      where: { id, companyId, kind },
      include: domainIncludes[kind],
    });
    if (!row) throw new NotFoundException("Data tidak ditemukan");
    return serializeRecord(row);
  }
  async save(
    companyId: string,
    kind: MasterKind,
    actorId: string,
    body: unknown,
    recordId?: string,
  ) {
    const parsed = validate(masterSchemaFor(kind), body);
    const input = {
      ...domainDefaults(kind),
      ...parsed,
      code: parsed.code.toUpperCase(),
    };
    const { expectedUpdatedAt } = validate(versionSchema, body);
    return this.prisma.$transaction(
      async (tx) => {
        await requireCompanyWrite(tx, companyId, actorId);
        const existing = recordId
          ? await tx.masterRecord.findFirst({
              where: { id: recordId, companyId, kind },
              include: domainIncludes[kind],
            })
          : null;
        if (recordId && !existing)
          throw new NotFoundException("Data tidak ditemukan");
        if (
          expectedUpdatedAt &&
          existing?.updatedAt.toISOString() !== expectedUpdatedAt
        )
          throw new ConflictException(
            "Data telah berubah. Muat ulang sebelum menyimpan perubahan.",
          );
        const before = existing ? serializeRecord(existing) : null;
        if (
          kind === "items" &&
          before &&
          (before.unit !== input.unit ||
            before.trackStock !== input.trackStock) &&
          (await tx.purchaseLine.count({
            where: { companyId, itemId: recordId },
          })) +
            (await tx.stockOperationLine.count({
              where: { companyId, itemId: recordId },
            })) +
            (await tx.salesLine.count({
              where: { companyId, itemId: recordId },
            })) +
            (await tx.bomLine.count({ where: { companyId, itemId: recordId } })) +
            (await tx.billOfMaterials.count({ where: { companyId, outputItemId: recordId } })) +
            (await tx.workOrderLine.count({ where: { companyId, itemId: recordId } })) +
            (await tx.workOrder.count({ where: { companyId, outputItemId: recordId } }))
        )
          throw new ConflictException(
            "Satuan dan pelacakan Stock tidak dapat diubah karena Items sudah digunakan dalam dokumen Procurement, Inventory, Sales, atau Manufacturing.",
          );
        if (["departments", "warehouses"].includes(kind)) {
          const branch = await tx.masterRecord.findFirst({
            where: {
              id: input.branchId,
              companyId,
              kind: "branches",
              branch: { isNot: null },
            },
          });
          if (
            !branch ||
            (branch.status !== "ACTIVE" && before?.branchId !== branch.id)
          )
            throw new BadRequestException(
              "Branch harus berasal dari company aktif dan berstatus Aktif.",
            );
        }
        if (
          kind === "branches" &&
          input.status === "INACTIVE" &&
          existing?.status === "ACTIVE"
        ) {
          const dependencies = await tx.masterRecord.count({
            where: {
              companyId,
              status: "ACTIVE",
              OR: [
                { department: { branchId: recordId } },
                { warehouse: { branchId: recordId } },
              ],
            },
          });
          if (dependencies)
            throw new ConflictException(
              "Branch masih digunakan oleh Department atau Warehouse aktif.",
            );
        }
        if (["branches", "departments"].includes(kind) && existing) {
          const dependency =
            kind === "branches"
              ? { branchId: recordId }
              : { departmentId: recordId };
          if (
            input.status === "INACTIVE" &&
            (await tx.employee.count({
              where: { companyId, status: "ACTIVE", ...dependency },
            }))
          )
            throw new ConflictException(
              "Data masih digunakan oleh Employee aktif. Pindahkan atau nonaktifkan Employee terlebih dahulu.",
            );
          if (
            kind === "departments" &&
            before?.branchId !== input.branchId &&
            (await tx.employee.count({
              where: { companyId, departmentId: recordId },
            }))
          )
            throw new ConflictException(
              "Branch Department tidak dapat diubah karena sudah digunakan oleh Employee. Buat Department tujuan lalu pindahkan Employee secara eksplisit.",
            );
        }
        const row = existing
          ? await tx.masterRecord.update({
              where: { companyId_id: { companyId, id: existing.id } },
              data: baseInput(input),
            })
          : await tx.masterRecord.create({
              data: { ...baseInput(input), companyId, kind },
            });
        await saveDomain(tx, companyId, kind, row.id, input);
        const saved = await tx.masterRecord.findUniqueOrThrow({
          where: { id: row.id },
          include: domainIncludes[kind],
        });
        const after = serializeRecord(saved);
        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            action: existing ? "UPDATE" : "CREATE",
            entity: kind,
            entityId: row.id,
            changes: JSON.parse(
              JSON.stringify({ before, after }),
            ) as Prisma.InputJsonValue,
          },
        });
        return after;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async delete(
    companyId: string,
    kind: MasterKind,
    actorId: string,
    recordId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await requireCompanyWrite(tx, companyId, actorId);
        const existing = await tx.masterRecord.findFirst({
          where: { id: recordId, companyId, kind },
          include: domainIncludes[kind],
        });
        if (!existing) throw new NotFoundException("Data tidak ditemukan");
        const referenced =
          kind === "items"
            ? await tx.purchaseLine.count({
                where: { companyId, itemId: recordId },
              })
            : kind === "suppliers"
              ? await tx.purchaseDocument.count({
                  where: { companyId, supplierId: recordId },
                })
              : kind === "warehouses"
                ? await tx.purchaseDocument.count({
                    where: { companyId, warehouseId: recordId },
                  })
                : 0;
        const stockReferenced =
          kind === "items"
            ? await tx.stockOperationLine.count({
                where: { companyId, itemId: recordId },
              })
            : kind === "warehouses"
              ? await tx.stockOperation.count({
                  where: {
                    companyId,
                    OR: [
                      { warehouseId: recordId },
                      { targetWarehouseId: recordId },
                    ],
                  },
                })
              : 0;
        const salesReferenced =
          kind === "items"
            ? await tx.salesLine.count({
                where: { companyId, itemId: recordId },
              })
            : kind === "customers"
              ? await tx.salesDocument.count({
                  where: { companyId, customerId: recordId },
                })
              : kind === "warehouses"
                ? await tx.salesDocument.count({
                    where: { companyId, warehouseId: recordId },
                  })
                : 0;
        if (
          ["branches", "departments"].includes(kind) &&
          (await tx.employee.count({
            where: {
              companyId,
              ...(kind === "branches"
                ? { branchId: recordId }
                : { departmentId: recordId }),
            },
          }))
        )
          throw new ConflictException(
            "Data masih digunakan oleh Employee. Pertahankan data untuk menyimpan riwayat organisasi.",
          );
        const manufacturingReferenced = kind === "items"
          ? (await tx.bomLine.count({ where: { companyId, itemId: recordId } })) + (await tx.billOfMaterials.count({ where: { companyId, outputItemId: recordId } })) + (await tx.workOrderLine.count({ where: { companyId, itemId: recordId } })) + (await tx.workOrder.count({ where: { companyId, outputItemId: recordId } }))
          : kind === "warehouses" ? await tx.workOrder.count({ where: { companyId, warehouseId: recordId } }) : 0;
        if (referenced || stockReferenced || salesReferenced || manufacturingReferenced)
          throw new ConflictException(
            "Data masih digunakan oleh dokumen Procurement, Inventory, Sales, atau Manufacturing. Nonaktifkan data untuk mempertahankan riwayat.",
          );
        if (kind === "branches") {
          const dependents =
            (await tx.department.count({
              where: { companyId, branchId: recordId },
            })) +
            (await tx.warehouse.count({
              where: { companyId, branchId: recordId },
            }));
          if (dependents)
            throw new ConflictException(
              "Data masih digunakan oleh Department atau Warehouse. Ubah relasinya sebelum menghapus Branch.",
            );
          await tx.branch.deleteMany({ where: { id: recordId, companyId } });
        }
        await tx.masterRecord.delete({
          where: { companyId_id: { companyId, id: recordId } },
        });
        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            action: "DELETE",
            entity: kind,
            entityId: recordId,
            changes: JSON.parse(
              JSON.stringify({ before: serializeRecord(existing) }),
            ) as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
@Controller("companies/:companyId")
@UseGuards(CompanyGuard)
class MasterDataController {
  constructor(
    @Inject(MasterDataService) private readonly service: MasterDataService,
  ) {}
  @Get("master-summary") summary(@Param("companyId") companyId: string) {
    return this.service.summary(companyId);
  }
  @Get("search") search(
    @Param("companyId") companyId: string,
    @Query("q") q: unknown,
  ) {
    return this.service.search(
      companyId,
      validate(z.string().trim().max(120).default(""), q),
    );
  }
  @Get("master/:kind") list(
    @Param("companyId") companyId: string,
    @Param("kind") kind: string,
    @Query() query: unknown,
  ) {
    return this.service.list(
      companyId,
      validate(kindSchema, kind),
      validate(catalogQuerySchema, query),
    );
  }
  @Get("master/:kind/:recordId") detail(
    @Param("companyId") companyId: string,
    @Param("kind") kind: string,
    @Param("recordId") recordId: string,
  ) {
    return this.service.detail(companyId, validate(kindSchema, kind), recordId);
  }
  @Post("master/:kind") @Roles("ADMIN", "MANAGER") create(
    @Param("companyId") companyId: string,
    @Param("kind") kind: string,
    @Body() body: unknown,
    @Req() request: AuthRequest,
  ) {
    return this.service.save(
      companyId,
      validate(kindSchema, kind),
      request.principal.id,
      body,
    );
  }
  @Patch("master/:kind/:recordId") @Roles("ADMIN", "MANAGER") update(
    @Param("companyId") companyId: string,
    @Param("kind") kind: string,
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: AuthRequest,
  ) {
    return this.service.save(
      companyId,
      validate(kindSchema, kind),
      request.principal.id,
      body,
      recordId,
    );
  }
  @Delete("master/:kind/:recordId")
  @Roles("ADMIN", "MANAGER")
  @HttpCode(204)
  delete(
    @Param("companyId") companyId: string,
    @Param("kind") kind: string,
    @Param("recordId") recordId: string,
    @Req() request: AuthRequest,
  ) {
    return this.service.delete(
      companyId,
      validate(kindSchema, kind),
      request.principal.id,
      recordId,
    );
  }
}
@Module({
  imports: [AuthModule],
  controllers: [MasterDataController],
  providers: [MasterDataService],
})
export class MasterDataModule {}
