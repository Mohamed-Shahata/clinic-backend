import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('MAIL_HOST'),
      port: this.config.get<number>('MAIL_PORT') ?? 587,
      secure: false,
      auth: {
        user: this.config.getOrThrow<string>('MAIL_USER'),
        pass: this.config.getOrThrow<string>('MAIL_PASS'),
      },
    });
  }

  async sendEmailVerification(opts: {
    to: string;
    fullName: string;
    code: string;
  }) {
    const from = `"Clinic CMS" <${this.config.get('MAIL_USER')}>`;
    await this.transporter.sendMail({
      from,
      to: opts.to,
      subject: 'تأكيد تغيير البريد الإلكتروني | Confirm Email Change',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
          <h2 style="color: #1e293b; margin-bottom: 8px;">تأكيد تغيير البريد الإلكتروني</h2>
          <p style="color: #475569;">مرحباً <strong>${opts.fullName}</strong>،</p>
          <p style="color: #475569;">لإتمام تغيير بريدك الإلكتروني، استخدم الكود التالي:</p>
          <div style="background: #1e293b; color: #f1f5f9; font-size: 28px; font-weight: bold; letter-spacing: 8px; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            ${opts.code}
          </div>
          <p style="color: #94a3b8; font-size: 13px;">هذا الكود صالح لمدة 15 دقيقة فقط. إذا لم تطلب هذا التغيير، يمكنك تجاهل هذه الرسالة.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">Clinic Management System</p>
        </div>
      `,
    });
    this.logger.log(`Email verification sent to ${opts.to}`);
  }

  async sendPasswordReset(opts: {
    to: string;
    fullName: string;
    code: string;
  }) {
    const from = `"Clinic CMS" <${this.config.get('MAIL_USER')}>`;
    await this.transporter.sendMail({
      from,
      to: opts.to,
      subject: 'إعادة تعيين كلمة المرور | Password Reset',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
          <h2 style="color: #1e293b; margin-bottom: 8px;">إعادة تعيين كلمة المرور</h2>
          <p style="color: #475569;">مرحباً <strong>${opts.fullName}</strong>،</p>
          <p style="color: #475569;">لإعادة تعيين كلمة مرورك، استخدم الكود التالي:</p>
          <div style="background: #1e293b; color: #f1f5f9; font-size: 28px; font-weight: bold; letter-spacing: 8px; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            ${opts.code}
          </div>
          <p style="color: #94a3b8; font-size: 13px;">هذا الكود صالح لمدة 15 دقيقة فقط. إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">Clinic Management System</p>
        </div>
      `,
    });
    this.logger.log(`Password reset sent to ${opts.to}`);
  }
}
