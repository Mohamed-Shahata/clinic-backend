import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { RequestUser } from "../types/request-user.type";
import { JwtPayload } from "../types/jwt-payload.type";
import { AuthSessionService } from "../auth-session.service";

/**
 * HIGH-01: No DB hit on every request.
 * Trust the signed JWT payload — it contains userId, clinicId, role, isSuperAdmin.
 * Only re-validate from DB on sensitive operations (password change, etc.) using
 * a dedicated guard on those specific routes.
 *
 * LOGIC-04: Clinic active-status is checked at login time and embedded in the JWT.
 * For real-time deactivation enforcement, add a lightweight Redis-based blocklist
 * checked here, or reduce JWT TTL (already done in auth.module.ts: 15m).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authSessionService: AuthSessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    if (!payload.sub) {
      throw new UnauthorizedException("Invalid token");
    }
    if (
      await this.authSessionService.isAccessTokenRevoked(payload.jti) ||
      await this.authSessionService.isClinicRevoked(payload.clinicId)
    ) {
      throw new UnauthorizedException("Token revoked");
    }
    return {
      userId: payload.sub,
      jti: payload.jti,
      exp: payload.exp,
      clinicId: payload.clinicId,
      clinicSlug: payload.clinicSlug,
      clinicName: payload.clinicName,
      role: payload.role,
      isSuperAdmin: payload.isSuperAdmin,
      email: payload.email,
    };
  }
}
