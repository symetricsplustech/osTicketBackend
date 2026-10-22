import { processPendingWebhookDeliveries } from "../shared/webhooks/dispatcher";
import { logger } from "../config/logger";

export async function runWebhookRetryJob(): Promise<{ processed: number }> {
  const processed = await processPendingWebhookDeliveries(50);
  if (processed > 0) {
    logger.debug({ processed }, "Webhook retry job processed deliveries");
  }
  return { processed };
}
