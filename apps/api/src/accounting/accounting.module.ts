import { Body, Controller, Get, Inject, Module, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CompanyGuard, Roles, type AuthRequest } from "../auth/access";
import { AccountsService } from "./accounts.service";
import { JournalsService } from "./journals.service";
import { LedgerService } from "./ledger.service";
import { AccountingPolicyService } from "./policy.service";
@Controller("companies/:companyId/accounting")
@UseGuards(CompanyGuard)
class AccountingController {
  constructor(@Inject(AccountsService) private readonly accounts: AccountsService, @Inject(JournalsService) private readonly journals: JournalsService, @Inject(LedgerService) private readonly ledger: LedgerService, @Inject(AccountingPolicyService) private readonly policy: AccountingPolicyService) {}
  @Get("policy") policyGet(@Param("companyId") c: string) { return this.policy.get(c); }
  @Post("policy/activate") @Roles("ADMIN") policyActivate(@Param("companyId") c: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.policy.activate(c, r.principal.id, b); }
  @Get("postings") postings(@Param("companyId") c: string, @Query() q: unknown) { return this.policy.postings(c, q); }
  @Get("summary") summary(@Param("companyId") c: string) { return this.ledger.summary(c); }
  @Get("accounts") accountList(@Param("companyId") c: string, @Query() q: unknown) { return this.accounts.list(c, q); }
  @Post("accounts") @Roles("ADMIN", "MANAGER") accountCreate(@Param("companyId") c: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.accounts.save(c, r.principal.id, b); }
  @Patch("accounts/:id") @Roles("ADMIN", "MANAGER") accountEdit(@Param("companyId") c: string, @Param("id") id: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.accounts.save(c, r.principal.id, b, id); }
  @Get("journals") journalList(@Param("companyId") c: string, @Query() q: unknown) { return this.journals.list(c, q); }
  @Get("journals/:id") journalDetail(@Param("companyId") c: string, @Param("id") id: string) { return this.journals.detail(c, id); }
  @Post("journals") @Roles("ADMIN", "MANAGER") journalCreate(@Param("companyId") c: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.journals.save(c, r.principal.id, b); }
  @Patch("journals/:id") @Roles("ADMIN", "MANAGER") journalEdit(@Param("companyId") c: string, @Param("id") id: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.journals.save(c, r.principal.id, b, id); }
  @Post("journals/:id/actions") @Roles("ADMIN", "MANAGER") journalAction(@Param("companyId") c: string, @Param("id") id: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.journals.action(c, r.principal.id, id, b); }
  @Post("journals/:id/reversal") @Roles("ADMIN") reverse(@Param("companyId") c: string, @Param("id") id: string, @Req() r: AuthRequest, @Body() b: unknown) { return this.journals.reverse(c, r.principal.id, id, b); }
  @Get("ledger") generalLedger(@Param("companyId") c: string, @Query() q: unknown) { return this.ledger.ledger(c, q); }
  @Get("ledger/export") ledgerExport(@Param("companyId") c: string, @Query() q: unknown) { return this.ledger.ledger(c, q, true); }
  @Get("trial-balance") trial(@Param("companyId") c: string, @Query() q: unknown) { return this.ledger.trial(c, q); }
  @Get("trial-balance/export") trialExport(@Param("companyId") c: string, @Query() q: unknown) { return this.ledger.trial(c, q, true); }
}
@Module({ imports: [AuthModule], controllers: [AccountingController], providers: [AccountsService, JournalsService, LedgerService, AccountingPolicyService] })
export class AccountingModule {}
