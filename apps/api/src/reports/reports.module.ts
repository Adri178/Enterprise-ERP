import {
  Controller,
  Get,
  Inject,
  Module,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CompanyGuard } from "../auth/access";
import { ReportsService } from "./reports.service";

@Controller("companies/:companyId/reports")
@UseGuards(CompanyGuard)
class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly service: ReportsService,
  ) {}
  @Get("invoices") invoices(
    @Param("companyId") company: string,
    @Query() query: unknown,
  ) {
    return this.service.invoices(company, query);
  }
  @Get("invoices/export") export(
    @Param("companyId") company: string,
    @Query() query: unknown,
  ) {
    return this.service.export(company, query);
  }
}
@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
