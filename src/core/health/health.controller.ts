import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { Public } from "../auth/decorators/public.decorator";

/**
 * PROD-04: Health check endpoint — required by load balancers, K8s liveness probes,
 * and uptime monitors. Without this, there's no reliable way to know if the service
 * is healthy without parsing application logs.
 *
 * GET /api/health → 200 { status: "ok", db: "ok" }
 * GET /api/health → 503 { status: "error", db: "unreachable" }
 */
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "ok", timestamp: new Date().toISOString() };
    } catch {
      return {
        status: "error",
        db: "unreachable",
        timestamp: new Date().toISOString(),
      };
    }
  }
}
