import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import { createHash, randomBytes, randomUUID } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { JwtPayload } from "./types/jwt-payload.type";

const ACCESS_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;
const REFRESH_TOKEN_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000;

type RefreshSession = {
  userId: string;
  payload: JwtPayload;
};

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  get accessTokenTtlSeconds() {
    return ACCESS_TOKEN_TTL_SECONDS;
  }

  /** Decode a signed JWT without verifying signature (payload only — for internal use after issueTokenPair). */
  decodePayload(accessToken: string): (JwtPayload & { jti?: string }) | null {
    try {
      return this.jwtService.decode(accessToken) as JwtPayload & {
        jti?: string;
      };
    } catch {
      return null;
    }
  }

  async issueTokenPair(payload: JwtPayload) {
    const accessJti = randomUUID();
    const refreshToken = randomBytes(48).toString("base64url");
    const refreshHash = this.hashToken(refreshToken);

    await this.cacheManager.set(
      this.refreshKey(refreshHash),
      JSON.stringify({ userId: payload.sub, payload } satisfies RefreshSession),
      REFRESH_TOKEN_TTL_MS,
    );

    return {
      accessToken: await this.jwtService.signAsync(
        { ...payload, jti: accessJti },
        { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      ),
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  async refresh(refreshToken: string) {
    const refreshHash = this.hashToken(refreshToken);
    const raw = await this.cacheManager.get<string>(
      this.refreshKey(refreshHash),
    );
    if (!raw) throw new UnauthorizedException("Invalid refresh token");

    await this.cacheManager.del(this.refreshKey(refreshHash));
    const session = JSON.parse(raw) as RefreshSession;
    return this.issueTokenPair(session.payload);
  }

  async revokeRefreshToken(refreshToken?: string) {
    if (!refreshToken) return;
    await this.cacheManager.del(this.refreshKey(this.hashToken(refreshToken)));
  }

  async revokeAccessToken(jti: string | undefined, expiresAtSeconds?: number) {
    if (!jti) return;
    const ttlMs = Math.max(
      1,
      ((expiresAtSeconds ??
        Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS) -
        Math.floor(Date.now() / 1000)) *
        1000,
    );
    await this.cacheManager.set(this.revokedAccessKey(jti), "1", ttlMs);
  }

  async isAccessTokenRevoked(jti?: string) {
    if (!jti) return true;
    return (
      (await this.cacheManager.get<string>(this.revokedAccessKey(jti))) === "1"
    );
  }

  // ── Clinic-level revocation ──────────────────────────────────────────────────
  async revokeClinicSessions(clinicId: string) {
    await this.cacheManager.set(
      this.clinicRevokedKey(clinicId),
      "1",
      REFRESH_TOKEN_TTL_MS,
    );
  }

  async clearClinicRevocation(clinicId: string) {
    await this.cacheManager.del(this.clinicRevokedKey(clinicId));
  }

  async isClinicRevoked(clinicId?: string) {
    if (!clinicId) return false;
    return (
      (await this.cacheManager.get<string>(this.clinicRevokedKey(clinicId))) ===
      "1"
    );
  }

  // ── User-level revocation (per receptionist deactivation) ───────────────────
  /**
   * Revoke all active sessions for a specific user.
   * Any request carrying a token for this userId will be rejected
   * until the flag expires (8h — covers the longest possible refresh window).
   */
  async revokeUserSessions(userId: string) {
    await this.cacheManager.set(
      this.userRevokedKey(userId),
      Date.now().toString(), // store timestamp so we can clear per-activation
      REFRESH_TOKEN_TTL_MS,
    );
  }

  async clearUserRevocation(userId: string) {
    await this.cacheManager.del(this.userRevokedKey(userId));
  }

  async isUserRevoked(userId?: string) {
    if (!userId) return false;
    return (
      (await this.cacheManager.get<string>(this.userRevokedKey(userId))) !==
        undefined &&
      (await this.cacheManager.get<string>(this.userRevokedKey(userId))) !==
        null
    );
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private refreshKey(hash: string) {
    return `auth:refresh:${hash}`;
  }

  private revokedAccessKey(jti: string) {
    return `auth:access:revoked:${jti}`;
  }

  private clinicRevokedKey(clinicId: string) {
    return `auth:clinic:revoked:${clinicId}`;
  }

  private userRevokedKey(userId: string) {
    return `auth:user:revoked:${userId}`;
  }
}
