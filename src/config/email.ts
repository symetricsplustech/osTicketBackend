import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTls?: boolean;
  user?: string;
  pass?: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
}

export function createSmtpTransport(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTls,
    auth: config.user
      ? {
          user: config.user,
          pass: config.pass,
        }
      : undefined,
    tls: {
      rejectUnauthorized: env.NODE_ENV === "production",
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export function fallbackSmtpConfig(): SmtpConfig | null {
  if (!env.SMTP_HOST) return null;
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    requireTls: env.SMTP_USE_TLS,
    user: env.SMTP_USER || undefined,
    pass: env.SMTP_PASS || undefined,
    fromEmail: env.MAIL_FROM,
    fromName: env.MAIL_FROM_NAME,
  };
}
