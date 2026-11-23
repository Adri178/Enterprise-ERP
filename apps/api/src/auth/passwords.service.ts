import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import { changePasswordSchema } from "@erp/shared";
import { PrismaService } from "../prisma/prisma.module";
import { validate } from "../common/validation";
@Injectable()
export class PasswordsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async change(userId: string, sessionVersion: number, body: unknown) {
    const input = validate(changePasswordSchema, body), before = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!before?.active || before.sessionVersion !== sessionVersion) throw new UnauthorizedException("Sesi tidak valid atau telah berakhir");
    if (!(await compare(input.currentPassword, before.passwordHash))) throw new BadRequestException("Password saat ini tidak sesuai");
    if (await compare(input.newPassword, before.passwordHash)) throw new BadRequestException("Gunakan password baru yang berbeda");
    const passwordHash = await hash(input.newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (!current.active || current.sessionVersion !== sessionVersion || current.passwordHash !== before.passwordHash) throw new ConflictException("Password atau sesi telah berubah. Silakan masuk kembali.");
      await tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } } });
      await tx.userSecurityEvent.create({ data: { userId, action: "PASSWORD_CHANGED" } });
    }, { isolationLevel: "Serializable" });
    return { message: "Password berhasil diperbarui. Silakan masuk kembali." };
  }
  async events(userId: string) { return this.prisma.userSecurityEvent.findMany({ where: { userId }, select: { id: true, action: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 20 }); }
}
