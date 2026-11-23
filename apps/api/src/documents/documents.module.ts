import {
  Controller,
  Get,
  Inject,
  Module,
  Param,
  UseGuards,
} from "@nestjs/common";
import { CompanyGuard } from "../auth/access";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma/prisma.module";
@Controller("companies/:companyId/documents")
@UseGuards(CompanyGuard)
class DocumentsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  @Get() async list(@Param("companyId") companyId: string) {
    const rows = await this.prisma.document.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
      take: 1000,
    });
    return rows.map((row) => ({
      ...row,
      amount: row.amount.toNumber(),
      date: row.date.toISOString().slice(0, 10),
    }));
  }
}
@Module({ imports: [AuthModule], controllers: [DocumentsController] })
export class DocumentsModule {}
