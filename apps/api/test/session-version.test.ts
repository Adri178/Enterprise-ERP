import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";
import { AuthGuard } from "../src/auth/access";
import type { PrismaService } from "../src/prisma/prisma.module";
async function check({ tokenVersion = 0, userVersion = 0, mustChange = false, allowed = false, active = true }: { tokenVersion?: number | null; userVersion?: number; mustChange?: boolean; allowed?: boolean; active?: boolean } = {}) {
  const reflector = { getAllAndOverride: (key: string) => key === "allowPasswordChange" && allowed } as unknown as Reflector;
  const jwt = { verifyAsync: async () => ({ sub: "user", ...(tokenVersion === null ? {} : { sv: tokenVersion }) }) } as unknown as JwtService;
  const prisma = { user: { findUnique: async () => ({ id: "user", active, sessionVersion: userVersion, mustChangePassword: mustChange }) } } as unknown as PrismaService;
  const request = { cookies: { erp_session: "test-only" } }, context = { getHandler: () => () => {}, getClass: () => AuthGuard, switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  return new AuthGuard(reflector, jwt, prisma).canActivate(context);
}
test("JWT sessions reject revoked versions and inactive accounts while preserving pre-migration version-zero sessions", async () => {
  assert.equal(await check(), true); assert.equal(await check({ tokenVersion: null }), true);
  await assert.rejects(() => check({ tokenVersion: null, userVersion: 1 }), UnauthorizedException);
  await assert.rejects(() => check({ tokenVersion: 0, userVersion: 1 }), UnauthorizedException);
  await assert.rejects(() => check({ active: false }), UnauthorizedException);
});
test("initial password changes are required before workspace access and allowed only on designated auth endpoints", async () => {
  await assert.rejects(() => check({ mustChange: true }), (error: unknown) => error instanceof ForbiddenException && (error.getResponse() as { code: string }).code === "PASSWORD_CHANGE_REQUIRED");
  assert.equal(await check({ mustChange: true, allowed: true }), true);
});
