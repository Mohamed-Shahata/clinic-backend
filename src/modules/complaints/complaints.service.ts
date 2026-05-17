import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { ComplaintCategory, ComplaintStatus } from "@prisma/client";
import { PrismaService } from "../../core/database/prisma.service";
import { RequestUser } from "../../core/auth/types/request-user.type";

export class CreateComplaintDto {
  @IsEnum(ComplaintCategory)
  category!: ComplaintCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
}

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: RequestUser, dto: CreateComplaintDto) {
    if (!user.clinicId) throw new ForbiddenException("No clinic context");
    return (this.prisma as any).complaint.create({
      data: {
        clinicId: user.clinicId,
        submittedBy: user.userId,
        category: dto.category,
        title: dto.title,
        description: dto.description,
      },
      select: { id: true, category: true, title: true, status: true, createdAt: true },
    });
  }

  async listMine(user: RequestUser) {
    if (!user.clinicId) throw new ForbiddenException("No clinic context");
    return (this.prisma as any).complaint.findMany({
      where: { clinicId: user.clinicId, submittedBy: user.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, category: true, title: true, description: true,
        status: true, adminReply: true, resolvedAt: true, createdAt: true,
      },
    });
  }

  async findOne(user: RequestUser, id: string) {
    const complaint = await (this.prisma as any).complaint.findUnique({
      where: { id },
      select: {
        id: true, clinicId: true, submittedBy: true,
        category: true, title: true, description: true,
        status: true, adminReply: true, resolvedAt: true,
        createdAt: true, updatedAt: true,
      },
    });
    if (!complaint) throw new NotFoundException("Complaint not found");
    if (complaint.clinicId !== user.clinicId && !user.isSuperAdmin)
      throw new ForbiddenException();
    return complaint;
  }

  // Super-admin: list all
  async listAll(status?: string) {
    return (this.prisma as any).complaint.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        clinic: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  // Super-admin: reply & update status
  async reply(id: string, adminReply: string, status: ComplaintStatus) {
    return (this.prisma as any).complaint.update({
      where: { id },
      data: {
        adminReply,
        status,
        resolvedAt: ["RESOLVED", "CLOSED"].includes(status) ? new Date() : null,
      },
    });
  }
}
