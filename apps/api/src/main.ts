import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
import { isTransactionConflict } from "./common/transaction-conflict";
import { frontendOrigin, sessionCookieOptions } from "./auth/session-config";
import { normalizeBasePath, deploymentRequestPath } from "@erp/shared";
@Catch()
class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      response
        .status(error.getStatus())
        .json(typeof body === "string" ? { message: body } : body);
      return;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      response
        .status(409)
        .json({ message: "Kode sudah digunakan pada company ini" });
      return;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      response.status(409).json({
        message:
          "Data masih digunakan oleh record terkait. Ubah relasinya sebelum menghapus data.",
      });
      return;
    }
    if (isTransactionConflict(error)) {
      response.status(409).json({
        message:
          "Data berubah saat proses berlangsung. Muat ulang lalu coba lagi.",
      });
      return;
    }
    response.status(500).json({ message: "Terjadi kesalahan pada server" });
  }
}
async function bootstrap() {
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    process.env.JWT_SECRET.startsWith("replace-")
  )
    throw new Error("JWT_SECRET harus berupa nilai acak minimal 32 karakter");
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL belum dikonfigurasi");
  const origin = frontendOrigin();
  const mountPath = normalizeBasePath(process.env.API_BASE_PATH);
  sessionCookieOptions();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  if (mountPath) app.use((request: Request, response: Response, next: NextFunction) => {
    try {
      request.url = deploymentRequestPath(mountPath, request.url, "strip");
    } catch {
      response.status(400).json({ message: "Request URL tidak valid" });
      return;
    }
    next();
  });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin, credentials: true });
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.origin &&
      request.headers.origin !== origin
    ) {
      response.status(403).json({ message: "Origin tidak diizinkan" });
      return;
    }
    next();
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.listen(
    Number(process.env.PORT || 4010),
    process.env.API_HOST || "127.0.0.1",
  );
}
void bootstrap();
