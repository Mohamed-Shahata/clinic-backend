import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ClinicRole } from "@prisma/client";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { Roles } from "../../core/auth/decorators/roles.decorator";
import { RolesGuard } from "../../core/auth/guards/roles.guard";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { ComplaintsService, CreateComplaintDto } from "./complaints.service";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { ComplaintStatus } from "@prisma/client";

class AdminReplyDto {
  @IsString()
  @MaxLength(2000)
  adminReply!: string;

  @IsEnum(ComplaintStatus)
  status!: ComplaintStatus;
}

@Controller("complaints")
@UseGuards(RolesGuard)
export class ComplaintsController {
  constructor(private readonly svc: ComplaintsService) {}

  @Post()
  @Roles(ClinicRole.DOCTOR_ADMIN)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateComplaintDto) {
    return this.svc.create(user, dto);
  }

  @Get("mine")
  @SkipThrottle()
  @Roles(ClinicRole.DOCTOR_ADMIN)
  listMine(@CurrentUser() user: RequestUser) {
    return this.svc.listMine(user);
  }

  @Get("mine/:id")
  @SkipThrottle()
  @Roles(ClinicRole.DOCTOR_ADMIN)
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.svc.findOne(user, id);
  }

  // Super-admin only
  @Get()
  @SkipThrottle()
  listAll(@CurrentUser() user: RequestUser, @Query("status") status?: string) {
    if (!user.isSuperAdmin) return [];
    return this.svc.listAll(status);
  }

  @Patch(":id/reply")
  reply(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: AdminReplyDto) {
    if (!user.isSuperAdmin) return null;
    return this.svc.reply(id, dto.adminReply, dto.status);
  }
}
