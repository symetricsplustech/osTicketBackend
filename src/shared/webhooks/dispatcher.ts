import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { decryptSecret } from "../encryption";
import { hmacSha256 } from "../utils/crypto";
import { truncate } from "../utils/sanitize";
import { assertSafeOutboundUrl } from "./ssrf";

function backoffSeconds(attempt: number): number {
  return Math.min(3600, 30 * 2 ** Math.max(0, attempt - 1));
}

export async function dispatchDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhook: true },
  });
  if (!delivery || delivery.status !== "PENDING") return;

  const webhook = delivery.webhook;
  if (!webhook.isEnabled) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        lastError: "Webhook is disabled.",
        nextRetryAt: null,
      },
    });
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    id: delivery.id,
    event: delivery.eventKey,
    createdAt: delivery.createdAt.toISOString(),
    test: delivery.isTest,
    data: delivery.payload,
  });

  try {
    await assertSafeOutboundUrl(webhook.url, {
      allowHttp: env.NODE_ENV !== "production",
    });
    const secret = decryptSecret(webhook.secretEnc);
    const signature = hmacSha256(`${timestamp}.${body}`, secret);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      env.WEBHOOK_TIMEOUT_MS,
    );
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ITSM-SaaS-Webhooks/1.0",
        "X-Webhook-Event": delivery.eventKey,
        "X-Webhook-Delivery": delivery.id,
        "X-Webhook-Timestamp": String(timestamp),
        "X-Webhook-Signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(timeout);

    const responseText = truncate(await response.text().catch(() => ""), 1000);

    if (response.status >= 200 && response.status < 300) {
      await prisma.$transaction([
        prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "SUCCESS",
            attempts: delivery.attempts + 1,
            responseStatus: response.status,
            responseBody: responseText,
            deliveredAt: new Date(),
            lastError: null,
            nextRetryAt: null,
          },
        }),
        prisma.webhook.update({
          where: { id: webhook.id },
          data: { lastDeliveryAt: new Date(), failureCount: 0 },
        }),
      ]);
      return;
    }

    throw new Error(
      `Destination responded with HTTP ${response.status}: ${truncate(responseText, 300)}`,
    );
  } catch (error) {
    const attempts = delivery.attempts + 1;
    const exhausted = attempts >= env.WEBHOOK_MAX_ATTEMPTS;
    const message = truncate(
      error instanceof Error ? error.message : String(error),
      500,
    );

    await prisma.$transaction([
      prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: exhausted ? "FAILED" : "PENDING",
          attempts,
          lastError: message,
          nextRetryAt: exhausted
            ? null
            : new Date(Date.now() + backoffSeconds(attempts) * 1000),
        },
      }),
      prisma.webhook.update({
        where: { id: webhook.id },
        data: { failureCount: { increment: 1 } },
      }),
    ]);

    if (!exhausted) {
      logger.warn(
        { deliveryId, attempts, error: message },
        "Webhook delivery failed — scheduled for retry",
      );
    } else {
      logger.error(
        { deliveryId, attempts, error: message },
        "Webhook delivery permanently failed",
      );
    }
  }
}

export async function processPendingWebhookDeliveries(
  limit = 25,
): Promise<number> {
  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: "PENDING",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const delivery of deliveries) {
    await dispatchDelivery(delivery.id);
  }
  return deliveries.length;
}

export async function queueWebhookDelivery(input: {
  webhookId: string;
  eventKey: string;
  payload: unknown;
  isTest?: boolean;
}): Promise<string> {
  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: input.webhookId,
      eventKey: input.eventKey,
      payload: (input.payload ?? {}) as object,
      isTest: input.isTest ?? false,
    },
  });
  return delivery.id;
}
