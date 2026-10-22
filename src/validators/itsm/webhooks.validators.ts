import { z } from "zod";

export const webhookIdParamSchema = z.object({ webhookId: z.string().min(1) });
export const webhookDeliveryIdParamSchema = z.object({
  deliveryId: z.string().min(1),
});

export const createWebhookSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    url: z.string().trim().url().max(2000),
    description: z.string().max(5000).optional(),
    eventKeys: z.array(z.string().trim().min(1).max(160)).max(200).optional(),
    isEnabled: z.boolean().optional(),
  })
  .strict();

export const updateWebhookSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    url: z.string().trim().url().max(2000).optional(),
    description: z.string().max(5000).optional(),
    eventKeys: z.array(z.string().trim().min(1).max(160)).max(200).optional(),
    isEnabled: z.boolean().optional(),
  })
  .strict();

export const testWebhookSchema = z
  .object({
    eventKey: z.string().trim().min(1).max(160).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
