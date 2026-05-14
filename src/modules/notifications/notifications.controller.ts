import { Controller, Get, Patch, Param, Sse, UseGuards } from "@nestjs/common";
import { Observable } from "rxjs";
import { JwtAuthGuard } from "../../core/auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../core/auth/decorators/current-user.decorator";
import { RequestUser } from "../../core/auth/types/request-user.type";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.svc.list(user);
  }

  @Get("unread-count")
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.svc.unreadCount(user).then((count) => ({ count }));
  }

  @Sse("stream")
  stream(@CurrentUser() user: RequestUser): Observable<MessageEvent> {
    return this.svc.stream(user);
  }

  @Patch(":id/read")
  markRead(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.svc.markRead(user, id);
  }

  @Patch("mark-all-read")
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.svc.markAllRead(user);
  }
}
