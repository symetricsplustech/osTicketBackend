import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import {
  createSmtpTransport,
  fallbackSmtpConfig,
  type SmtpConfig,
} from "../../config/email";
import { decryptJson } from "../encryption";
import { truncate } from "../utils/sanitize";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  templateId?: string;
  ruleId?: string;
  metadata?: Record<string, unknown>;
  providerId?: string;
  tenantId?: string;
}

export interface SendEmailResult {
  deliveryId: string | null;
  status: "SENT" | "FAILED" | "SUPPRESSED";
  error?: string;
}

/** Structural provider shape shared by platform (EmailProvider) and tenant providers. */
export interface EmailProviderLike {
  id: string;
  key: string;
  providerType: string;
  fromEmail: string;
  fromName: string | null;
  replyTo?: string | null;
  configEnc: string;
}

interface ResolvedSender {
  provider: EmailProviderLike | null;
  smtp?: SmtpConfig;
  kind: string;
}

function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    masked[key] = /pass|secret|key|token/i.test(key) ? "[REDACTED]" : value;
  }
  return masked;
}

export async function resolveSender(
  providerId?: string,
  tenantId?: string,
): Promise<ResolvedSender> {
  if (providerId) {
    const provider = await prisma.emailProvider.findUnique({
      where: { id: providerId },
    });
    if (provider && provider.status !== "DISABLED")
      return { provider, kind: provider.providerType };
  }
  if (tenantId) {
    const tenantProvider = await prisma.tenantEmailProvider.findFirst({
      where: { tenantId, status: "ACTIVE", isDefault: true, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (tenantProvider)
      return { provider: tenantProvider, kind: tenantProvider.providerType };
  }
  const provider = await prisma.emailProvider.findFirst({
    where: { status: "ACTIVE", isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  if (provider) return { provider, kind: provider.providerType };

  const smtp = fallbackSmtpConfig();
  if (smtp) return { provider: null, smtp, kind: "SMTP_ENV" };

  return { provider: null, kind: "NONE" };
}

async function sendViaProvider(
  sender: ResolvedSender,
  input: SendEmailInput,
): Promise<void> {
  const { provider } = sender;
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const fromEmail =
    provider?.fromEmail ?? sender.smtp?.fromEmail ?? "no-reply@example.com";
  const fromName =
    provider?.fromName ?? sender.smtp?.fromName ?? "ITSM Platform";

  if (!provider) {
    const smtp = sender.smtp!;
    const transporter = createSmtpTransport(smtp);
    await transporter.sendMail({
      from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
      to: recipients.join(", "),
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo ?? smtp.replyTo,
    });
    transporter.close();
    return;
  }

  const config = decryptJson<Record<string, string>>(provider.configEnc);

  switch (provider.providerType) {
    case "SMTP": {
      const transporter = createSmtpTransport({
        host: config["host"] ?? "",
        port: Number(config["port"] ?? 587),
        secure: String(config["secure"] ?? "false") === "true",
        user: config["user"] || undefined,
        pass: config["pass"] || undefined,
        fromEmail,
        fromName: fromName ?? undefined,
        replyTo: provider.replyTo ?? undefined,
      });
      await transporter.sendMail({
        from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
        to: recipients.join(", "),
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo ?? provider.replyTo ?? undefined,
      });
      transporter.close();
      return;
    }

    case "SENDGRID": {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config["apiKey"] ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: recipients.map((email) => ({ email })) }],
          from: { email: fromEmail, name: fromName ?? undefined },
          reply_to:
            (input.replyTo ?? provider.replyTo)
              ? { email: input.replyTo ?? provider.replyTo }
              : undefined,
          subject: input.subject,
          content: [
            ...(input.text ? [{ type: "text/plain", value: input.text }] : []),
            { type: "text/html", value: input.html },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(
          `SendGrid responded with ${response.status}: ${truncate(await response.text(), 300)}`,
        );
      }
      return;
    }

    case "MAILGUN": {
      const domain = config["domain"] ?? "";
      const form = new URLSearchParams();
      form.set("from", fromName ? `${fromName} <${fromEmail}>` : fromEmail);
      for (const recipient of recipients) form.append("to", recipient);
      form.set("subject", input.subject);
      form.set("html", input.html);
      if (input.text) form.set("text", input.text);
      if (input.replyTo ?? provider.replyTo)
        form.set("h:Reply-To", input.replyTo ?? provider.replyTo ?? "");
      const response = await fetch(
        `https://api.mailgun.net/v3/${domain}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`api:${config["apiKey"] ?? ""}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        },
      );
      if (!response.ok) {
        throw new Error(
          `Mailgun responded with ${response.status}: ${truncate(await response.text(), 300)}`,
        );
      }
      return;
    }

    case "RESEND": {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config["apiKey"] ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
          to: recipients,
          subject: input.subject,
          html: input.html,
          text: input.text,
          reply_to: input.replyTo ?? provider.replyTo ?? undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Resend responded with ${response.status}: ${truncate(await response.text(), 300)}`,
        );
      }
      return;
    }

    case "POSTMARK": {
      const response = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": config["serverToken"] ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          From: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
          To: recipients.join(", "),
          Subject: input.subject,
          HtmlBody: input.html,
          TextBody: input.text,
          ReplyTo: input.replyTo ?? provider.replyTo ?? undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Postmark responded with ${response.status}: ${truncate(await response.text(), 300)}`,
        );
      }
      return;
    }

    default:
      throw new Error(
        `Unsupported email provider type: ${provider.providerType}`,
      );
  }
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).filter(
    Boolean,
  );
  const sender = await resolveSender(input.providerId, input.tenantId);

  if (sender.kind === "NONE") {
    logger.warn(
      { subject: input.subject },
      "No email provider configured — delivery suppressed",
    );
    const suppressed = await prisma.deliveryLog.create({
      data: {
        channel: "EMAIL",
        recipient: recipients.join(", "),
        subject: input.subject,
        status: "SUPPRESSED",
        attempts: 0,
        lastError: "No email provider is configured.",
        templateId: input.templateId ?? null,
        payloadMeta: input.metadata ? (input.metadata as object) : undefined,
      },
    });
    return {
      deliveryId: suppressed.id,
      status: "SUPPRESSED",
      error: "No email provider is configured.",
    };
  }

  const delivery = await prisma.deliveryLog.create({
    data: {
      providerId: sender.provider?.id ?? null,
      ruleId: input.ruleId ?? null,
      templateId: input.templateId ?? null,
      channel: "EMAIL",
      recipient: recipients.join(", "),
      subject: input.subject,
      status: "QUEUED",
      payloadMeta: input.metadata ? (input.metadata as object) : undefined,
    },
  });

  try {
    await sendViaProvider(sender, input);
    await prisma.deliveryLog.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        attempts: 1,
        lastError: null,
      },
    });
    return { deliveryId: delivery.id, status: "SENT" };
  } catch (error) {
    const message = truncate(
      error instanceof Error ? error.message : String(error),
      500,
    );
    await prisma.deliveryLog.update({
      where: { id: delivery.id },
      data: { status: "FAILED", attempts: 1, lastError: message },
    });
    logger.error(
      { error: message, provider: sender.provider?.key ?? "env-smtp" },
      "Email delivery failed",
    );
    return { deliveryId: delivery.id, status: "FAILED", error: message };
  }
}

export async function verifyEmailProvider(
  provider: EmailProviderLike,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (provider.providerType === "SMTP") {
      const config = decryptJson<Record<string, string>>(provider.configEnc);
      const transporter = createSmtpTransport({
        host: config["host"] ?? "",
        port: Number(config["port"] ?? 587),
        secure: String(config["secure"] ?? "false") === "true",
        user: config["user"] || undefined,
        pass: config["pass"] || undefined,
        fromEmail: provider.fromEmail,
        fromName: provider.fromName ?? undefined,
      });
      await transporter.verify();
      transporter.close();
      return { ok: true, message: "SMTP connection verified." };
    }

    const config = decryptJson<Record<string, string>>(provider.configEnc);
    const checks: Record<
      string,
      { url: string; headers: Record<string, string> }
    > = {
      SENDGRID: {
        url: "https://api.sendgrid.com/v3/scopes",
        headers: { Authorization: `Bearer ${config["apiKey"] ?? ""}` },
      },
      MAILGUN: {
        url: "https://api.mailgun.net/v3/domains",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${config["apiKey"] ?? ""}`).toString("base64")}`,
        },
      },
      RESEND: {
        url: "https://api.resend.com/domains",
        headers: { Authorization: `Bearer ${config["apiKey"] ?? ""}` },
      },
      POSTMARK: {
        url: "https://api.postmarkapp.com/server",
        headers: { "X-Postmark-Server-Token": config["serverToken"] ?? "" },
      },
    };
    const check = checks[provider.providerType];
    if (!check)
      return {
        ok: false,
        message: `Provider type ${provider.providerType} does not support verification.`,
      };
    const response = await fetch(check.url, { headers: check.headers });
    if (response.ok)
      return { ok: true, message: "Provider credentials verified." };
    const body = truncate(await response.text(), 300);
    return {
      ok: false,
      message: `Provider responded with ${response.status}: ${body}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: truncate(
        error instanceof Error ? error.message : String(error),
        300,
      ),
    };
  }
}

export { maskConfig };
