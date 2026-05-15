import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";

export interface CreateServiceDto {
  name: string;
  price: number;
  category?: string;
}

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(clinicId: string) {
    return (this.prisma as any).serviceCatalog.findMany({
      where: { clinicId, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async create(clinicId: string, dto: CreateServiceDto) {
    if (!dto.name?.trim()) throw new BadRequestException("name is required");
    if (!dto.price || dto.price <= 0) throw new BadRequestException("price must be > 0");
    return (this.prisma as any).serviceCatalog.create({
      data: { clinicId, name: dto.name.trim(), price: dto.price, category: dto.category?.trim() ?? null },
    });
  }

  async update(clinicId: string, id: string, dto: Partial<CreateServiceDto>) {
    const svc = await (this.prisma as any).serviceCatalog.findFirst({ where: { id, clinicId } });
    if (!svc) throw new NotFoundException("Service not found");
    return (this.prisma as any).serviceCatalog.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.category !== undefined ? { category: dto.category?.trim() ?? null } : {}),
      },
    });
  }

  async remove(clinicId: string, id: string) {
    const svc = await (this.prisma as any).serviceCatalog.findFirst({ where: { id, clinicId } });
    if (!svc) throw new NotFoundException("Service not found");
    await (this.prisma as any).serviceCatalog.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }
}
