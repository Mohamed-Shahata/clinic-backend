import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../database/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./auth-session.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { SuperAdminThrottlerGuard } from "./guards/super-admin-throttler.guard";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { RbacService } from "./rbac/rbac.service";

@Global()
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
        // TTL يتطابق مع ACCESS_TOKEN_TTL_SECONDS في auth-session.service.ts
        // الجلسة لا تنتهي من تلقاء نفسها — الـ revocation يتم عبر Redis فقط
        signOptions: { expiresIn: "365d" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    RbacService,
    JwtStrategy,
    Reflector,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: SuperAdminThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService, AuthSessionService, RbacService],
})
export class AuthModule {}
