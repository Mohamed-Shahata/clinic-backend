import { Module } from "@nestjs/common";
import { PrismaModule } from "../../core/database/prisma.module";
import { ClinicsController } from "./clinics.controller";
import { ClinicsService } from "./clinics.service";

@Module({
  imports: [PrismaModule],
  controllers: [ClinicsController],
  providers: [ClinicsService],
})
export class ClinicsModule {}
