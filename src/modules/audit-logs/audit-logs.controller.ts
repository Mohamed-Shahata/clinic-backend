import { Controller, Get, Query } from "@nestjs/common";
import { Permissions } from "../../core/auth/rbac/permissions.decorator";
import { Permission } from "../../core/auth/rbac/role-permissions";
import { AuditLogsService } from "./audit-logs.service";

@Controller("audit-logs")
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Permissions(Permission.VIEW_AUDIT_LOGS)
  list(
    @Query("clinicId") clinicId?: string,
    @Query("action") action?: string,
    @Query("entityType") entityType?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    // FIX: Audit logs are exposed only through the SUPER_ADMIN permission.
    return this.auditLogsService.list({
      clinicId,
      action,
      entityType,
      from,
      to,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }
}
