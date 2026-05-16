import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { RequestUser } from "../types/request-user.type";
import { JwtPayload } from "../types/jwt-payload.type";
import { AuthSessionService } from "../auth-session.service";

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

    // Check in parallel for speed
    const [accessRevoked, clinicRevoked, userRevoked] = await Promise.all([
      this.authSessionService.isAccessTokenRevoked(payload.jti),
      this.authSessionService.isClinicRevoked(payload.clinicId),
      this.authSessionService.isUserRevoked(payload.sub),
    ]);

    if (accessRevoked || clinicRevoked || userRevoked) {
      throw new UnauthorizedException("Session revoked");
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
