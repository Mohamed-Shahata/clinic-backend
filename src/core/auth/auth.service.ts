import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject } from "@nestjs/common";
import type { Cache } from "cache-manager";
import { compare, hash } from "bcryptjs";
import { PrismaService } from "../database/prisma.service";
import { LoginDto } from "./dto/login.dto";
import {
  ForgotPasswordRequestDto,
  ForgotPasswordResetDto,
  RequestEmailChangeDto,
  ConfirmEmailChangeDto,
  ChangePasswordDto,
} from "./dto/password-reset.dto";
import { JwtPayload } from "./types/jwt-payload.type";
import { MailService } from "../mail/mail.service";
import { AuthSessionService } from "./auth-session.service";
import { normalizeLoginIdentifier } from "./phone.util";

const OTP_TTL_MS = 15 * 60 * 1000;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly authSessionService: AuthSessionService,
  ) {}

  private async isClinicActive(clinicId: string): Promise<boolean> {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        isActive: true,
        subscription: { select: { expiresAt: true, status: true } },
      } as any,
    });

    // 1) العيادة معطلة يدوياً من الـ super-admin
    if (!(clinic as any)?.isActive) return false;

    // 2) الاشتراك منتهي أو غير موجود
    const sub = (clinic as any)?.subscription;
    if (!sub) return false; // لا يوجد اشتراك على الإطلاق
    if (sub.status !== "ACTIVE") return false;
    if (new Date(sub.expiresAt) <= new Date()) return false;

    return true;
  }

  async login(dto: LoginDto) {
    const normalized = normalizeLoginIdentifier(dto.login ?? dto.email);
    if (!normalized) throw new UnauthorizedException("Invalid credentials");

    const user =
      normalized.kind === "phone"
        ? await this.prisma.user.findUnique({
            where: { phone: normalized.value },
          })
        : await this.prisma.user.findUnique({
            where: { email: normalized.value },
          });

    if (!user) throw new UnauthorizedException("Invalid credentials");

    const isPasswordValid = await compare(dto.password, user.passwordHash);
    if (!isPasswordValid)
      throw new UnauthorizedException("Invalid credentials");

    let clinicId: string | undefined;
    let clinicSlug: string | undefined;
    let clinicName: string | undefined;
    let role: JwtPayload["role"];

    if (!user.isSuperAdmin) {
      const slugFilter = dto.clinicSlug?.trim();

      if (slugFilter) {
        const membership = await this.prisma.clinicUser.findFirst({
          where: {
            userId: user.id,
            clinic: { slug: slugFilter },
          },
          include: { clinic: true },
        });

        if (!membership) {
          throw new UnauthorizedException("No membership for this clinic");
        }

        // ── Account deactivated by doctor ──────────────────────────────────
        if (!membership.isActive) {
          throw new UnauthorizedException(
            "account_deactivated:تم إلغاء تفعيل حسابك من قِبل الدكتور. تواصل مع الإدارة.",
          );
        }

        // ── Clinic deactivated by super-admin ──────────────────────────────
        if (!(await this.isClinicActive(membership.clinicId))) {
          throw new UnauthorizedException(
            "clinic_deactivated:العيادة موقوفة مؤقتاً. تواصل مع الإدارة.",
          );
        }

        clinicId = membership.clinicId;
        role = membership.role;
        clinicSlug = membership.clinic.slug;
        clinicName = membership.clinic.name;
      } else {
        const memberships = await this.prisma.clinicUser.findMany({
          where: { userId: user.id },
          include: { clinic: true },
          orderBy: { createdAt: "asc" },
        });

        // Filter active memberships in active clinics
        const activeMemberships: typeof memberships = [];
        for (const m of memberships) {
          if (!m.isActive) continue; // account deactivated
          if (!(await this.isClinicActive(m.clinicId))) continue; // clinic deactivated
          activeMemberships.push(m);
        }

        // Check if user HAS memberships but all are deactivated
        if (memberships.length > 0 && activeMemberships.length === 0) {
          // Determine why — account or clinic
          const hasInactiveAccount = memberships.some((m) => !m.isActive);
          if (hasInactiveAccount) {
            throw new UnauthorizedException(
              "account_deactivated:تم إلغاء تفعيل حسابك من قِبل الدكتور. تواصل مع الإدارة.",
            );
          }
          throw new UnauthorizedException(
            "clinic_deactivated:العيادة موقوفة مؤقتاً. تواصل مع الإدارة.",
          );
        }

        if (activeMemberships.length === 0) {
          throw new UnauthorizedException(
            "No clinic membership for this account",
          );
        }

        if (activeMemberships.length > 1) {
          throw new UnauthorizedException(
            "This account is linked to multiple clinics. Ask your administrator for your clinic code (clinicSlug).",
          );
        }

        const membership = activeMemberships[0];
        clinicId = membership.clinicId;
        role = membership.role;
        clinicSlug = membership.clinic.slug;
        clinicName = membership.clinic.name;
      }
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      clinicId,
      clinicSlug,
      clinicName,
      role,
    };

    const tokenPair = await this.authSessionService.issueTokenPair(payload);

    return {
      ...tokenPair,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isSuperAdmin: user.isSuperAdmin,
        clinicId,
        clinicSlug,
        clinicName,
        role,
      },
    };
  }

  async refresh(refreshToken: string) {
    // أولاً: جدد التوكن من الـ session store
    const result = await this.authSessionService.refresh(refreshToken);

    // ثانياً: تحقق أن العيادة والحساب لا يزالان فعّالين
    // (يمكن أن يتغير الوضع بين آخر login وهذا الـ refresh)
    const payload = this.authSessionService.decodePayload(result.accessToken);

    if (payload?.clinicId) {
      // فحص تعطيل العيادة / انتهاء الاشتراك
      const clinicOk = await this.isClinicActive(payload.clinicId);
      if (!clinicOk) {
        // أبطل الجلسة الجديدة فوراً حتى لا تُستخدم
        await this.authSessionService.revokeClinicSessions(payload.clinicId);
        throw new UnauthorizedException(
          "clinic_deactivated:العيادة موقوفة أو انتهى اشتراكها. تواصل مع الإدارة.",
        );
      }

      // فحص تعطيل الحساب الفردي (doctor / receptionist)
      const membership = await this.prisma.clinicUser.findFirst({
        where: { userId: payload.sub, clinicId: payload.clinicId },
        select: { isActive: true },
      });
      if (membership && !membership.isActive) {
        await this.authSessionService.revokeUserSessions(payload.sub);
        throw new UnauthorizedException(
          "account_deactivated:تم إلغاء تفعيل حسابك. تواصل مع الإدارة.",
        );
      }
    }

    return result;
  }

  async logout(
    refreshToken: string | undefined,
    accessJti?: string,
    accessExp?: number,
  ) {
    await Promise.all([
      this.authSessionService.revokeRefreshToken(refreshToken),
      this.authSessionService.revokeAccessToken(accessJti, accessExp),
    ]);
    return { success: true };
  }

  // ─── Forgot Password ─────────────────────────────────────────────────────────

  async requestForgotPassword(dto: ForgotPasswordRequestDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } as any });
    if (!user)
      return { message: "If this email exists, a reset code has been sent." };

    const code = generateCode();
    await this.cacheManager.set(
      `forgot:${email}`,
      JSON.stringify({ code }),
      OTP_TTL_MS,
    );
    await this.mailService.sendPasswordReset({
      to: email,
      fullName: user.fullName,
      code,
    });
    return { message: "If this email exists, a reset code has been sent." };
  }

  async resetForgotPassword(dto: ForgotPasswordResetDto) {
    const email = dto.email.trim().toLowerCase();
    const raw = await this.cacheManager.get<string>(`forgot:${email}`);
    if (!raw) throw new BadRequestException("Invalid or expired reset code");
    const { code } = JSON.parse(raw) as { code: string };
    if (code !== dto.code)
      throw new BadRequestException("Invalid or expired reset code");
    await this.cacheManager.del(`forgot:${email}`);

    const user = await this.prisma.user.findUnique({ where: { email } as any });
    if (!user) throw new BadRequestException("User not found");
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(dto.newPassword, 10) },
    });
    return { message: "Password reset successfully" };
  }

  // ─── Email Change ─────────────────────────────────────────────────────────────

  async requestEmailChange(userId: string, dto: RequestEmailChangeDto) {
    const newEmail = dto.newEmail.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email: newEmail, NOT: { id: userId } } as any,
    });
    if (existing) throw new BadRequestException("This email is already in use");

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const code = generateCode();
    await this.cacheManager.set(
      `email-change:${userId}`,
      JSON.stringify({ code, newEmail }),
      OTP_TTL_MS,
    );
    await this.mailService.sendEmailVerification({
      to: newEmail,
      fullName: user.fullName,
      code,
    });
    return { message: "Verification code sent to new email" };
  }

  async confirmEmailChange(userId: string, dto: ConfirmEmailChangeDto) {
    const raw = await this.cacheManager.get<string>(`email-change:${userId}`);
    if (!raw)
      throw new BadRequestException("Invalid or expired verification code");
    const { code, newEmail } = JSON.parse(raw) as {
      code: string;
      newEmail: string;
    };
    if (code !== dto.code)
      throw new BadRequestException("Invalid or expired verification code");
    if (!newEmail) throw new BadRequestException("Invalid session");
    await this.cacheManager.del(`email-change:${userId}`);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { email: newEmail } as any,
    });
    return { message: "Email updated successfully", email: updated.email };
  }

  // ─── Change Password ──────────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const isValid = await compare(dto.currentPassword, user.passwordHash);
    if (!isValid)
      throw new BadRequestException("Current password is incorrect");
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(dto.newPassword, 10) },
    });
    return { message: "Password changed successfully" };
  }
}
