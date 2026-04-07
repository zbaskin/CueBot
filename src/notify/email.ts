import nodemailer from 'nodemailer';
import type { Alert } from '../monitor/ticket-monitor.js';
import type { EmailConfig } from '../config.js';

export async function sendEmailNotification(alert: Alert, config: EmailConfig): Promise<void> {
  if (!config.enabled) return;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[email] SMTP credentials missing in .env — skipping email notification');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? '587', 10),
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_FROM ?? SMTP_USER,
    to: config.to,
    subject: `CueBot: ${alert.message}`,
    text: `${alert.message}\n\nBook tickets: ${alert.url}`,
    html: `<p>${alert.message}</p><p><a href="${alert.url}">Book tickets now</a></p>`,
  });
}
