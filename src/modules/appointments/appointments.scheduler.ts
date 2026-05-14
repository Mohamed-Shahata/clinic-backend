import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AppointmentsService } from "./appointments.service";

/**
 * PERF-01: Moves stale-appointment cleanup out of every read request.
 * Runs once per day at 00:05 instead of on every list() call.
 * Requires @nestjs/schedule installed and ScheduleModule.forRoot() in app.module.ts.
 */
@Injectable()
export class AppointmentsScheduler {
  private readonly logger = new Logger(AppointmentsScheduler.name);

  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cancelStaleAppointments() {
    this.logger.log("Running stale appointment cleanup...");
    try {
      await this.appointmentsService.cancelStaleWaitingAppointments();
      this.logger.log("Stale appointment cleanup complete.");
    } catch (err) {
      this.logger.error("Stale appointment cleanup failed", err);
    }
  }
}
