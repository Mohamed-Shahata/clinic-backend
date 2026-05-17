import { Injectable, ForbiddenException } from "@nestjs/common";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { PrismaService } from "../../core/database/prisma.service";
import { RequestUser } from "../../core/auth/types/request-user.type";

export class UpsertRatingDto {
  @IsInt() @Min(1) @Max(5) overall!: number;
  @IsInt() @Min(1) @Max(5) ease!: number;
  @IsInt() @Min(1) @Max(5) features!: number;
  @IsInt() @Min(1) @Max(5) support!: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
  @IsBoolean() wouldRefer!: boolean;
}

@Injectable()
export class SiteRatingService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(user: RequestUser, dto: UpsertRatingDto) {
    if (!user.clinicId) throw new ForbiddenException("No clinic context");
    return (this.prisma as any).siteRating.upsert({
      where: { clinicId_submittedBy: { clinicId: user.clinicId, submittedBy: user.userId } },
      create: { clinicId: user.clinicId, submittedBy: user.userId, ...dto },
      update: { ...dto },
    });
  }

  async getMine(user: RequestUser) {
    if (!user.clinicId) throw new ForbiddenException("No clinic context");
    return (this.prisma as any).siteRating.findUnique({
      where: { clinicId_submittedBy: { clinicId: user.clinicId, submittedBy: user.userId } },
    });
  }

  // Super-admin: aggregate stats
  async getStats() {
    const all = await (this.prisma as any).siteRating.findMany({
      select: { overall: true, ease: true, features: true, support: true, wouldRefer: true },
    });
    if (!all.length) return { count: 0, overall: 0, ease: 0, features: 0, support: 0, referRate: 0 };
    const avg = (key: string) =>
      Math.round((all.reduce((s: number, r: any) => s + r[key], 0) / all.length) * 10) / 10;
    return {
      count: all.length,
      overall: avg("overall"),
      ease: avg("ease"),
      features: avg("features"),
      support: avg("support"),
      referRate: Math.round((all.filter((r: any) => r.wouldRefer).length / all.length) * 100),
    };
  }
}
