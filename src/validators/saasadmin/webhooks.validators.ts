import { z } from "zod";
import { WEBHOOK_EVENT_KEYS } from "../../shared/constants";

export const webhookIdParamSchema = z.object({
  webhookId: z.string().min(1, "Webhook identifier is required."),
});

export const webhookDeliveryParamSchema = z.object({
  webhookId: z.string().min(1, "Webhook identifier is required."),
  deliveryId: z.string().min(1, "Delivery identifier is required."),
});

export function isValidWebhookEventKey(key: string): boolean {
  return key === "*" || (WEBHOOK_EVENT_KEYS as readonly string[]).includes(key);
}

const webhookEventKeySchema = z
  .string()
  .trim()
  .min(1, "Event keys cannot be empty.")
  .refine(isValidWebhookEventKey, "Unknown webhook event key.");

const webhookEventKeysSchema = z
  .array(webhookEventKeySchema)
  .min(1, "At least one event key is required.")
  .max(50, "A maximum of 50 event keys may be subscribed.")
  .refine(
    (keys) => new Set(keys).size === keys.length,
    "Event keys must be unique.",
  );

export const createWebhookSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Webhook name must be at least 2 characters.")
    .max(120),
  description: z.string().trim().max(2000).optional(),
  url: z.string().trim().url("A valid absolute URL is required."),
  eventKeys: webhookEventKeysSchema,
  isEnabled: z.boolean().optional().default(true),
});

export const updateWebhookSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  url: z.string().trim().url("A valid absolute URL is required.").optional(),
  eventKeys: webhookEventKeysSchema.optional(),
  isEnabled: z.boolean().optional(),
});

export const testWebhookSchema = z.object({
  eventKey: webhookEventKeySchema.optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type TestWebhookInput = z.infer<typeof testWebhookSchema>;
