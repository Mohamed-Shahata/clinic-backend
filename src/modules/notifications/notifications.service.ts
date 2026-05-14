import { Injectable } from "@nestjs/common";
import { Observable, Subject, filter, interval, map, merge } from "rxjs";
import { PrismaService } from "../../core/database/prisma.service";
import { RequestUser } from "../../core/auth/types/request-user.type";

type NotificationPayload = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  meta?: Record<string, unknown> | null;
  createdAt: Date;
};

@Injectable()
export class NotificationsService {
  private readonly events$ = new Subject<NotificationPayload>();

  constructor(private readonly prisma: PrismaService) {}

  async createForUser(
    userId: string,
    type: string,
    title: string,
    body: string,
    meta?: Record<string, unknown>,
  ) {
    const notification = await (this.prisma as any).notification.create({
      data: { userId, type, title, body, meta: meta ?? null },
    });
    this.events$.next(notification);
    return notification;
  }

  async list(user: RequestUser) {
    await this.ensureSubscriptionExpiryNotification(user);
    return (this.prisma as any).notification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  }

  async markRead(user: RequestUser, id: string) {
    return (this.prisma as any).notification.updateMany({
      where: { id, userId: user.userId },
      data: { isRead: true },
    });
  }

  async markAllRead(user: RequestUser) {
    return (this.prisma as any).notification.updateMany({
      where: { userId: user.userId, isRead: false },
      data: { isRead: true },
    });
  }

  async unreadCount(user: RequestUser): Promise<number> {
    await this.ensureSubscriptionExpiryNotification(user);
    return (this.prisma as any).notification.count({
      where: { userId: user.userId, isRead: false },
    });
  }

  stream(user: RequestUser): Observable<MessageEvent> {
    void this.ensureSubscriptionExpiryNotification(user);
    const notifications$ = this.events$.pipe(
      filter((notification) => notification.userId === user.userId),
      map(
        (notification) =>
          ({
            data: notification,
          }) as MessageEvent,
      ),
    );
    const heartbeat$ = interval(15000).pipe(
      map(() => ({ type: "heartbeat", data: { ok: true } }) as MessageEvent),
    );
    return merge(notifications$, heartbeat$);
  }

  private async ensureSubscriptionExpiryNotification(user: RequestUser) {
    if (!user.clinicId) return;

    const subscription = await (this.prisma as any).clinicSubscription.findUnique({
      where: { clinicId: user.clinicId },
      select: { expiresAt: true, status: true },
    });
    if (!subscription || subscription.status !== "ACTIVE") return;

    const now = new Date();
    const expiresAt = new Date(subscription.expiresAt);
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);
    if (daysLeft < 0 || daysLeft > 7) return;

    const since = new Date(now);
    since.setHours(0, 0, 0, 0);
    const existing = await (this.prisma as any).notification.findFirst({
      where: {
        userId: user.userId,
        type: "SUBSCRIPTION_EXPIRING_SOON",
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (existing) return;

    await this.createForUser(
      user.userId,
      "SUBSCRIPTION_EXPIRING_SOON",
      "اشتراكك قرب ينتهي",
      `متبقي ${Math.max(daysLeft, 0)} يوم على انتهاء الاشتراك. جدد الاشتراك لتجنب توقف الخدمة.`,
      {
        clinicId: user.clinicId,
        expiresAt,
        daysLeft: Math.max(daysLeft, 0),
        link: "/dashboard/doctor-admin/subscription",
      },
    );
  }
}
