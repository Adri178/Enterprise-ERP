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
import { AuthModule } from "../auth/auth.module";
import { CompanyGuard, Roles, type AuthRequest } from "../auth/access";
import { SalesService } from "./sales.service";
@Controller("companies/:companyId/sales")
@UseGuards(CompanyGuard)
class SalesController {
  constructor(@Inject(SalesService) private readonly service: SalesService) {}
  @Get() list(@Param("companyId") company: string, @Query() query: unknown) {
    return this.service.list(company, query);
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
  @Post("quotations") @Roles("ADMIN", "MANAGER") create(
    @Param("companyId") company: string,
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.create(company, request.principal.id, body);
  }
  @Post("from-source") @Roles("ADMIN", "MANAGER") fromSource(
    @Param("companyId") company: string,
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.fromSource(company, request.principal.id, body);
  }
  @Post(":id/actions") @Roles("ADMIN", "MANAGER") action(
    @Param("companyId") company: string,
    @Param("id") id: string,
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.action(company, request.principal.id, id, body);
  }
}
@Module({
  imports: [AuthModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
