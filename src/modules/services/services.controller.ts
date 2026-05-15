import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RolesGuard } from "../../core/auth/guards/roles.guard";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { ServicesService, CreateServiceDto } from "./services.service";

@Controller("services")
@UseGuards(RolesGuard)
export class ServicesController {
  constructor(private readonly svc: ServicesService) {}

  @Get()
  findAll(@CurrentUser() u: RequestUser) {
    return this.svc.findAll(u.clinicId!);
  }

  @Post()
  create(@CurrentUser() u: RequestUser, @Body() dto: CreateServiceDto) {
    return this.svc.create(u.clinicId!, dto);
  }

  @Patch(":id")
  update(@CurrentUser() u: RequestUser, @Param("id") id: string, @Body() dto: Partial<CreateServiceDto>) {
    return this.svc.update(u.clinicId!, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() u: RequestUser, @Param("id") id: string) {
    return this.svc.remove(u.clinicId!, id);
  }
}
