import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { Role } from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
export const Public = () => SetMetadata("public", true);
export const AllowPasswordChange = () => SetMetadata("allowPasswordChange", true);
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
export const AllowInactiveCompany = () =>
  SetMetadata("allowInactiveCompany", true);
export interface AuthRequest extends Request {
  principal: { id: string; sessionVersion: number };
  membership?: { companyId: string; role: Role };
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>("public", [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token =
      request.cookies?.erp_session ||
      request.headers.authorization?.replace(/^Bearer /, "");
    if (!token)
      throw new UnauthorizedException("Silakan masuk terlebih dahulu");
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sv?: number }>(token, {
        algorithms: ["HS256"],
        audience: "enterprise-erp",
        issuer: "enterprise-erp-api",
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, active: true, sessionVersion: true, mustChangePassword: true },
      });
      if (!user?.active || (payload.sv ?? 0) !== user.sessionVersion) throw new Error("Inactive or revoked");
      if (user.mustChangePassword && !this.reflector.getAllAndOverride<boolean>("allowPasswordChange", [context.getHandler(), context.getClass()])) throw new ForbiddenException({ message: "Ganti password sebelum mengakses workspace", code: "PASSWORD_CHANGE_REQUIRED" });
      request.principal = { id: user.id, sessionVersion: user.sessionVersion };
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException("Sesi tidak valid atau telah berakhir");
    }
  }
}
export function assertCompanyRole(
  membership: { companyId: string; role: Role; active?: boolean } | null,
  companyId: string,
  required: Role[],
) {
  if (!membership || membership.active === false || membership.companyId !== companyId)
    throw new ForbiddenException("Anda tidak memiliki akses ke company ini");
  if (required.length && !required.includes(membership.role))
    throw new ForbiddenException(
      "Role Anda tidak memiliki izin untuk aksi ini",
    );
}
@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const companyId = request.params.companyId as string;
    if (!request.principal || !companyId) throw new ForbiddenException();
    const membership = await this.prisma.membership.findUnique({
      where: { userId_companyId: { userId: request.principal.id, companyId } },
      include: { company: { select: { status: true } } },
    });
    const required =
      this.reflector.getAllAndOverride<Role[]>("roles", [
        context.getHandler(),
        context.getClass(),
      ]) || [];
    assertCompanyRole(membership, companyId, required);
    if (
      membership?.company.status === "INACTIVE" &&
      !["GET", "HEAD"].includes(request.method) &&
      !this.reflector.getAllAndOverride<boolean>("allowInactiveCompany", [
        context.getHandler(),
        context.getClass(),
      ])
    )
      throw new ForbiddenException(
        "Company tidak aktif. Aktifkan Company sebelum mengubah data.",
      );
    request.membership = membership!;
    return true;
  }
}
