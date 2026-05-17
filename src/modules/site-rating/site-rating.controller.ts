import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ClinicRole } from "@prisma/client";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { Roles } from "../../core/auth/decorators/roles.decorator";
import { RolesGuard } from "../../core/auth/guards/roles.guard";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { SiteRatingService, UpsertRatingDto } from "./site-rating.service";

@Controller("site-rating")
@UseGuards(RolesGuard)
export class SiteRatingController {
  constructor(private readonly svc: SiteRatingService) {}

  @Post()
  @Roles(ClinicRole.DOCTOR_ADMIN)
  upsert(@CurrentUser() user: RequestUser, @Body() dto: UpsertRatingDto) {
    return this.svc.upsert(user, dto);
  }

  @Get("mine")
  @SkipThrottle()
  @Roles(ClinicRole.DOCTOR_ADMIN)
  getMine(@CurrentUser() user: RequestUser) {
    return this.svc.getMine(user);
  }

  @Get("stats")
  @SkipThrottle()
  getStats(@CurrentUser() user: RequestUser) {
    if (!user.isSuperAdmin) return null;
    return this.svc.getStats();
  }
}
