import {
  Body,
  Controller,
  Get,
  Inject,
  Module,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { purchaseQuerySchema } from "@erp/shared";
import { AuthModule } from "../auth/auth.module";
import { CompanyGuard, Roles, type AuthRequest } from "../auth/access";
import { validate } from "../common/validation";
import { ProcurementService } from "./procurement.service";
import { StockService } from "./stock.service";
import { StockOperationsService } from "./stock-operations.service";
import { RfqService } from "./rfq.service";
@Controller("companies/:companyId/rfqs")
@UseGuards(CompanyGuard)
class RfqController {
  constructor(@Inject(RfqService) private readonly service: RfqService) {}
  @Get() list(@Param("companyId") company: string, @Query() query: unknown) { return this.service.list(company, query); }
  @Get("eligible-requests") requests(@Param("companyId") company: string, @Query() query: unknown) { return this.service.requests(company, query); }
  @Get("export") export(@Param("companyId") company: string, @Query() query: unknown) { return this.service.export(company, query); }
  @Get(":id") detail(@Param("companyId") company: string, @Param("id") id: string) { return this.service.detail(company, id); }
  @Post() @Roles("ADMIN", "MANAGER") create(@Param("companyId") company: string, @Req() req: AuthRequest, @Body() body: unknown) { return this.service.create(company, req.principal.id, body); }
  @Post(":id/offers") @Roles("ADMIN", "MANAGER") offer(@Param("companyId") company: string, @Param("id") id: string, @Req() req: AuthRequest, @Body() body: unknown) { return this.service.offer(company, req.principal.id, id, body); }
  @Post(":id/actions") @Roles("ADMIN", "MANAGER") action(@Param("companyId") company: string, @Param("id") id: string, @Req() req: AuthRequest, @Body() body: unknown) { return this.service.action(company, req.principal.id, id, body); }
  @Post(":id/purchase-order") @Roles("ADMIN", "MANAGER") order(@Param("companyId") company: string, @Param("id") id: string, @Req() req: AuthRequest, @Body() body: unknown) { return this.service.order(company, req.principal.id, id, body); }
}
@Controller("companies/:companyId/procurement")
@UseGuards(CompanyGuard)
class ProcurementController {
  constructor(
    @Inject(ProcurementService) private readonly service: ProcurementService,
  ) {}
  @Get() list(@Param("companyId") company: string, @Query() query: unknown) {
    return this.service.list(company, validate(purchaseQuerySchema, query));
  }
  @Get("summary") summary(@Param("companyId") company: string) {
    return this.service.summary(company);
  }
  @Get("analytics") analytics(@Param("companyId") company: string) {
    return this.service.analytics(company);
  }
  @Get(":id") detail(
    @Param("companyId") company: string,
    @Param("id") id: string,
  ) {
    return this.service.detail(company, id);
  }
  @Post("requests") @Roles("ADMIN", "MANAGER") request(
    @Param("companyId") company: string,
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.createRequest(company, req.principal.id, body);
  }
  @Post("from-source") @Roles("ADMIN", "MANAGER") fromSource(
    @Param("companyId") company: string,
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.createFromSource(company, req.principal.id, body);
  }
  @Post(":id/actions") @Roles("ADMIN", "MANAGER") action(
    @Param("companyId") company: string,
    @Param("id") id: string,
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.action(company, req.principal.id, id, body);
  }
}
@Controller("companies/:companyId/stock")
@UseGuards(CompanyGuard)
class StockController {
  constructor(
    @Inject(StockService) private readonly service: StockService,
    @Inject(StockOperationsService)
    private readonly operations: StockOperationsService,
  ) {}
  @Get("operations") operationsList(
    @Param("companyId") company: string,
    @Query() query: unknown,
  ) {
    return this.operations.list(company, query);
  }
  @Get("operations/:id") operation(
    @Param("companyId") company: string,
    @Param("id") id: string,
  ) {
    return this.operations.detail(company, id);
  }
  @Post("operations") @Roles("ADMIN", "MANAGER") create(
    @Param("companyId") company: string,
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.operations.create(company, request.principal.id, body);
  }
  @Post("operations/:id/actions") @Roles("ADMIN", "MANAGER") action(
    @Param("companyId") company: string,
    @Param("id") id: string,
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.operations.action(company, request.principal.id, id, body);
  }
  @Get("balances") balances(
    @Param("companyId") company: string,
    @Query() query: unknown,
  ) {
    return this.service.list(company, query, false);
  }
  @Get("ledger") ledger(
    @Param("companyId") company: string,
    @Query() query: unknown,
  ) {
    return this.service.list(company, query, true);
  }
}
@Module({
  imports: [AuthModule],
  controllers: [ProcurementController, StockController, RfqController],
  providers: [ProcurementService, StockService, StockOperationsService, RfqService],
})
export class ProcurementModule {}
