import { Body, Controller, Get, Inject, Module, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CompanyGuard, Roles, type AuthRequest } from "../auth/access";
import { AuthModule } from "../auth/auth.module";
import { PermissionsService } from "./permissions.service";
@Controller("companies/:companyId/access") @UseGuards(CompanyGuard) @Roles("ADMIN")
class PermissionsController {
  constructor(@Inject(PermissionsService) private readonly service: PermissionsService) {}
  @Get("users") list(@Param("companyId") c: string, @Req() r: AuthRequest, @Query() q: unknown) { return this.service.list(c, r.principal.id, q); }
  @Post("users") grant(@Param("companyId") c: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.service.grant(c, r.principal.id, b); }
  @Patch("users/:userId") edit(@Param("companyId") c: string, @Param("userId") u: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.service.edit(c, r.principal.id, u, b); }
  @Get("audit") audit(@Param("companyId") c: string, @Req() r: AuthRequest, @Query() q: unknown) { return this.service.audit(c, r.principal.id, q); }
}
@Module({ imports: [AuthModule], controllers: [PermissionsController], providers: [PermissionsService] })
export class PermissionsModule {}
