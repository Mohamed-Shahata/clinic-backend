import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";
import { AppointmentsScheduler } from "./appointments.scheduler";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsScheduler],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
