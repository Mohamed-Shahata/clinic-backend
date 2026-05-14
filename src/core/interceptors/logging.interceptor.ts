import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { randomUUID } from "node:crypto";

/**
 * PROD-03: Request logging interceptor with correlation IDs.
 * Logs method, URL, status code, and duration for every request
 * so errors in production can be traced back to their context.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const correlationId = randomUUID();
    req.correlationId = correlationId;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        const ms = Date.now() - start;
        this.logger.log(
          `[${correlationId}] ${method} ${url} ${res.statusCode} +${ms}ms`,
        );
      }),
    );
  }
}
