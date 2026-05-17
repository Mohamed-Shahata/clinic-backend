import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { CacheModule } from "@nestjs/cache-manager";
import { AuthModule } from "./core/auth/auth.module";
import { PrismaModule } from "./core/database/prisma.module";
import { MailModule } from "./core/mail/mail.module";
import { UploadModule } from "./core/upload/upload.module";
import { HealthController } from "./core/health/health.controller";
import { ClinicsModule } from "./modules/clinics/clinics.module";
import { PatientsModule } from "./modules/patients/patients.module";
import { UsersModule } from "./modules/users/users.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { PrescriptionsModule } from "./modules/prescriptions/prescriptions.module";
import { BillingModule } from "./modules/billing/billing.module";
import { ServicesModule } from "./modules/services/services.module";
import { InstallmentsModule } from "./modules/installments/installments.module";
import { SalariesModule } from "./modules/salaries/salaries.module";
import { ComplaintsModule } from "./modules/complaints/complaints.module";
import { SiteRatingModule } from "./modules/site-rating/site-rating.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: "login", ttl: 60_000, limit: 5 },
      { name: "otp", ttl: 60_000, limit: 3 },
    ]),
    CacheModule.register({ isGlobal: true, ttl: 0 }),
    PrismaModule,
    MailModule,
    UploadModule,
    AuthModule,
    ClinicsModule,
    PatientsModule,
    UsersModule,
    AppointmentsModule,
    PrescriptionsModule,
    BillingModule,
    ServicesModule,
    InstallmentsModule,
    SalariesModule,
    NotificationsModule,
    ComplaintsModule,
    SiteRatingModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
