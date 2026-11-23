import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import { compare } from "bcryptjs";
import type { Response } from "express";
import { loginSchema } from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { validate } from "../common/validation";
import { type AuthRequest, AllowPasswordChange, CompanyGuard, Public } from "./access";
import { sessionCookieOptions } from "./session-config";
import { PasswordsService } from "./passwords.service";
@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}
  async login(input: unknown) {
    const values = validate(loginSchema, input);
    const user = await this.prisma.user.findUnique({
      where: { email: values.email.toLowerCase() },
    });
    // A fixed hash keeps unknown-email checks comparable in cost to a valid lookup.
    const matches = await compare(
      values.password,
      user?.passwordHash ||
        "$2b$12$NXpAMRKxHOF3Qkfj3R4E3O7Jv8YzFLX1dzg7K9ZQ3qjGQYB0T2CKC",
    );
    if (!user?.active || !matches)
      throw new UnauthorizedException("Email atau password tidak sesuai");
    const token = await this.jwt.signAsync(
      { sub: user.id, sv: user.sessionVersion },
      {
        algorithm: "HS256",
        expiresIn: "2h",
        audience: "enterprise-erp",
        issuer: "enterprise-erp-api",
      },
    );
    return token;
  }
  async profile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        mustChangePassword: true,
        memberships: {
          where: { active: true },
          include: {
            company: {
              include: {
                accountingPolicy: { select: { companyId: true } },
                _count: {
                  select: {
                    documents: true,
                    purchases: true,
                    sales: true,
                    journals: true,
                    workOrders: true,
                    stockOperations: true,
                    masterData: {
                      where: {
                        item: {
                          OR: [
                            { purchasePrice: { gt: 0 } },
                            { sellingPrice: { gt: 0 } },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { companyId: "asc" },
        },
      },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
      companies: user.memberships.map((m) => {
        const { _count, accountingPolicy, ...company } = m.company;
        return {
          ...company,
          role: m.role,
          currencyLocked:
            !!accountingPolicy ||
            _count.documents > 0 ||
            _count.purchases > 0 ||
            _count.sales > 0 ||
            _count.journals > 0 ||
            _count.workOrders > 0 ||
            _count.stockOperations > 0 ||
            _count.masterData > 0,
        };
      }),
    };
  }
}
@Controller("auth")
class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(PasswordsService) private readonly passwords: PasswordsService) {}
  @Public()
  @Post("login")
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = await this.auth.login(body);
    response.cookie("erp_session", token, {
      ...sessionCookieOptions(),
      maxAge: 7200000,
    });
    return { message: "Berhasil masuk" };
  }
  @Public()
  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie("erp_session", sessionCookieOptions());
    return { message: "Berhasil keluar" };
  }
  @Get("me") @AllowPasswordChange() profile(@Req() request: AuthRequest) {
    return this.auth.profile(request.principal.id);
  }
  @Post("change-password") @AllowPasswordChange()
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async changePassword(@Req() request: AuthRequest, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = await this.passwords.change(request.principal.id, request.principal.sessionVersion, body);
    response.clearCookie("erp_session", sessionCookieOptions());
    return result;
  }
  @Get("security-events") @AllowPasswordChange() events(@Req() request: AuthRequest) { return this.passwords.events(request.principal.id); }
}
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({ secret: process.env.JWT_SECRET }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, CompanyGuard, PasswordsService],
  exports: [AuthService, CompanyGuard, JwtModule],
})
export class AuthModule {}
