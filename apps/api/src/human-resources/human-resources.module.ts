import {
  Body,
  Controller,
  Get,
  Inject,
  Module,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CompanyGuard, Roles, type AuthRequest } from "../auth/access";
import { EmployeesService } from "./employees.service";
import { LeavesService } from "./leaves.service";
import { AttendanceService } from "./attendance.service";
@Controller("companies/:companyId/hr")
@UseGuards(CompanyGuard)
class HrController {
  constructor(
    @Inject(EmployeesService) private readonly employees: EmployeesService,
    @Inject(LeavesService) private readonly leaves: LeavesService,
    @Inject(AttendanceService) private readonly attendance: AttendanceService,
  ) {}
  @Get("summary") summary(@Param("companyId") company: string) {
    return this.employees.summary(company);
  }
  @Get("attendance") attendanceList(@Param("companyId") company: string, @Query() query: unknown) { return this.attendance.list(company, query); }
  @Get("attendance/export") attendanceExport(@Param("companyId") company: string, @Query() query: unknown) { return this.attendance.export(company, query); }
  @Get("attendance/:id") attendanceDetail(@Param("companyId") company: string, @Param("id") id: string) { return this.attendance.detail(company, id); }
  @Post("attendance") @Roles("ADMIN", "MANAGER") attendanceCreate(@Param("companyId") company: string, @Req() request: AuthRequest, @Body() body: unknown) { return this.attendance.create(company, request.principal.id, body); }
  @Patch("attendance/:id") @Roles("ADMIN", "MANAGER") attendanceCorrect(@Param("companyId") company: string, @Param("id") id: string, @Req() request: AuthRequest, @Body() body: unknown) { return this.attendance.correct(company, request.principal.id, id, body); }
  @Get("employees") employeeList(
    @Param("companyId") company: string,
    @Query() query: unknown,
  ) {
    return this.employees.list(company, query);
  }
  @Get("employees/:id") employeeDetail(
    @Param("companyId") company: string,
    @Param("id") id: string,
  ) {
    return this.employees.detail(company, id);
  }
  @Post("employees") @Roles("ADMIN", "MANAGER") employeeCreate(
    @Param("companyId") company: string,
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.employees.save(company, request.principal.id, body);
  }
  @Patch("employees/:id") @Roles("ADMIN", "MANAGER") employeeUpdate(
    @Param("companyId") company: string,
    @Param("id") id: string,
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.employees.save(company, request.principal.id, body, id);
  }
  @Get("leave-requests") leaveList(
    @Param("companyId") company: string,
    @Query() query: unknown,
  ) {
    return this.leaves.list(company, query);
  }
  @Get("leave-requests/:id") leaveDetail(
    @Param("companyId") company: string,
    @Param("id") id: string,
  ) {
    return this.leaves.detail(company, id);
  }
  @Post("leave-requests") @Roles("ADMIN", "MANAGER") leaveCreate(
    @Param("companyId") company: string,
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.leaves.create(company, request.principal.id, body);
  }
  @Post("leave-requests/:id/actions") @Roles("ADMIN", "MANAGER") leaveAction(
    @Param("companyId") company: string,
    @Param("id") id: string,
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.leaves.action(company, request.principal.id, id, body);
  }
}
@Module({
  imports: [AuthModule],
  controllers: [HrController],
  providers: [EmployeesService, LeavesService, AttendanceService],
})
export class HumanResourcesModule {}
