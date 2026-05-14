import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * PROD-06: Configure connection pool via DATABASE_URL query params:
 * postgresql://user:pass@host/db?connection_limit=20&pool_timeout=10
 * Default Prisma pool is only 5 connections — too low for production.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // PROD-01: Disconnect cleanly on SIGTERM / PM2 restart / K8s pod termination.
  // Without this, in-flight DB transactions get rolled back and clients see errors.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
