import { IsIn } from "class-validator";

export class UpdateAppointmentStatusDto {
  @IsIn(["IN_QUEUE", "IN_PROGRESS", "COMPLETED", "CANCELLED"], {
    message:
      "Status must be one of: IN_QUEUE, IN_PROGRESS, COMPLETED, CANCELLED",
  })
  status!: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}
