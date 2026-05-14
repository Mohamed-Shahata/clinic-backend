import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as express from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./core/filters/all-exceptions.filter";
import { LoggingInterceptor } from "./core/interceptors/logging.interceptor";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // ── Security headers (CRIT-03) ─────────────────────────────────────────────
  app.use(helmet());

  // ── Body size limit — prevent OOM from huge payloads (PROD-05) ────────────
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  });

  app.setGlobalPrefix("api");

  // ── Global validation (unchanged) ─────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ── Global exception filter — hides stack traces in production (PROD-02) ──
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Request logging (PROD-03) ──────────────────────────────────────────────
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ── Graceful shutdown hooks — lets Prisma disconnect cleanly (PROD-01) ────
  app.enableShutdownHooks();

  await app.listen(3001);
}

void bootstrap();
