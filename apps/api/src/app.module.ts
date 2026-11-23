import { Controller, Get, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { AuthGuard, Public } from "./auth/access";
import { CompaniesModule } from "./companies/companies.module";
import { MasterDataModule } from "./master-data/master-data.module";
import { DocumentsModule } from "./documents/documents.module";
import { ProcurementModule } from "./procurement/procurement.module";
import { SalesModule } from "./sales/sales.module";
import { ReportsModule } from "./reports/reports.module";
import { HumanResourcesModule } from "./human-resources/human-resources.module";
import { AccountingModule } from "./accounting/accounting.module";
import { ManufacturingModule } from "./manufacturing/manufacturing.module";
import { PermissionsModule } from "./permissions/permissions.module";
@Controller("health")
class HealthController {
  @Public() @Get() health() {
    return { status: "ok", service: "enterprise-erp-api", phase: 3 };
  }
}
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CompaniesModule,
    MasterDataModule,
    DocumentsModule,
    ProcurementModule,
    SalesModule,
    ReportsModule,
    HumanResourcesModule,
    AccountingModule,
    ManufacturingModule,
    PermissionsModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
