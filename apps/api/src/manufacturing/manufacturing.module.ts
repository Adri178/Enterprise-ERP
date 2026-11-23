import { Body, Controller, Get, Inject, Module, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CompanyGuard, Roles, type AuthRequest } from "../auth/access";
import { BomsService } from "./boms.service";
import { WorkOrdersService } from "./work-orders.service";
import { ProductionPlanService } from "./production-plan.service";
@Controller("companies/:companyId/manufacturing") @UseGuards(CompanyGuard)
class ManufacturingController {
  constructor(@Inject(BomsService) private readonly boms: BomsService, @Inject(WorkOrdersService) private readonly orders: WorkOrdersService, @Inject(ProductionPlanService) private readonly planning: ProductionPlanService) {}
  @Get("summary") summary(@Param("companyId") c: string) { return this.planning.summary(c); }
  @Get("plan") plan(@Param("companyId") c: string, @Query() q: unknown) { return this.planning.plan(c, q); }
  @Get("boms") listBoms(@Param("companyId") c: string, @Query() q: unknown) { return this.boms.list(c, q); }
  @Get("boms/:id") bom(@Param("companyId") c: string, @Param("id") id: string) { return this.boms.detail(c, id); }
  @Post("boms") @Roles("ADMIN", "MANAGER") createBom(@Param("companyId") c: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.boms.save(c, r.principal.id, b); }
  @Patch("boms/:id") @Roles("ADMIN", "MANAGER") editBom(@Param("companyId") c: string, @Param("id") id: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.boms.save(c, r.principal.id, b, id); }
  @Post("boms/:id/actions") @Roles("ADMIN", "MANAGER") bomAction(@Param("companyId") c: string, @Param("id") id: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.boms.action(c, r.principal.id, id, b); }
  @Get("work-orders") listOrders(@Param("companyId") c: string, @Query() q: unknown) { return this.orders.list(c, q); }
  @Get("work-orders/:id") order(@Param("companyId") c: string, @Param("id") id: string) { return this.orders.detail(c, id); }
  @Post("work-orders") @Roles("ADMIN", "MANAGER") createOrder(@Param("companyId") c: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.orders.create(c, r.principal.id, b); }
  @Post("work-orders/:id/actions") @Roles("ADMIN", "MANAGER") orderAction(@Param("companyId") c: string, @Param("id") id: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.orders.action(c, r.principal.id, id, b); }
}
@Module({ imports: [AuthModule], controllers: [ManufacturingController], providers: [BomsService, WorkOrdersService, ProductionPlanService] })
export class ManufacturingModule {}
