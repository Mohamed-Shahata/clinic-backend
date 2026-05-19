import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { RequestUser } from "../types/request-user.type";

@Injectable()
export class SuperAdminThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    // FIX: SUPER_ADMIN requests are explicitly whitelisted from throttling.
    if (req.user?.isSuperAdmin) return true;
    return super.shouldSkip(context);
  }
}
