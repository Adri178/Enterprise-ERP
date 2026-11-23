import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Module,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthModule, AuthService } from "../auth/auth.module";
import {
  AllowInactiveCompany,
  CompanyGuard,
  Roles,
  type AuthRequest,
} from "../auth/access";
import { CompaniesService } from "./companies.service";
@Controller("companies")
class CompaniesController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(CompaniesService) private readonly service: CompaniesService,
  ) {}
  @Get() async list(@Req() request: AuthRequest) {
    return (await this.auth.profile(request.principal.id)).companies;
  }
  @Post() create(@Req() request: AuthRequest, @Body() body: unknown) {
    return this.service.create(request.principal.id, body);
  }
  @Patch(":companyId")
  @UseGuards(CompanyGuard)
  @Roles("ADMIN")
  @AllowInactiveCompany()
  update(
    @Param("companyId") companyId: string,
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.update(companyId, request.principal.id, body);
  }
  @Delete(":companyId")
  @UseGuards(CompanyGuard)
  @Roles("ADMIN")
  @AllowInactiveCompany()
  @HttpCode(204)
  archive(@Param("companyId") companyId: string, @Req() request: AuthRequest) {
    return this.service.archive(companyId, request.principal.id);
  }
}
@Module({
  imports: [AuthModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
