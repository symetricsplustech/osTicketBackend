import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { dispatchDelivery, queueWebhookDelivery } from "../webhooks/dispatcher";

export interface PlatformEvent {
  eventKey: string;
  tenantId?: string | null;
  payload: Record<string, unknown>;
}

export async function publishEvent(event: PlatformEvent): Promise<void> {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { isEnabled: true },
      select: { id: true, eventKeys: true },
    });

    const deliveryIds: string[] = [];
    for (const webhook of webhooks) {
      const subscribed = Array.isArray(webhook.eventKeys)
        ? (webhook.eventKeys as unknown[]).map(String)
        : [];
      if (!subscribed.includes(event.eventKey) && !subscribed.includes("*"))
        continue;
      const id = await queueWebhookDelivery({
        webhookId: webhook.id,
        eventKey: event.eventKey,
        payload: {
          tenantId: event.tenantId ?? null,
          ...event.payload,
        },
      });
      deliveryIds.push(id);
    }

    for (const id of deliveryIds) {
      void dispatchDelivery(id).catch((error) => {
        logger.warn(
          { error, deliveryId: id },
          "Immediate webhook dispatch failed; will retry",
        );
      });
    }
  } catch (error) {
    logger.error(
      { error, eventKey: event.eventKey },
      "Failed to publish platform event",
    );
  }
}
