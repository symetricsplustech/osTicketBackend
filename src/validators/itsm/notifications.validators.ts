import { z } from "zod";

export {
  createProviderSchema,
  updateProviderSchema,
  providerIdParamSchema,
  testProviderSchema,
  validateProviderConfig,
  type CreateProviderInput,
  type UpdateProviderInput,
  type TestProviderInput,
  type ProviderConfigIssue,
} from "../saasadmin/email-notifications.validators";

export const notificationTemplateIdParamSchema = z.object({
  templateId: z.string().min(1),
});
export const notificationRuleIdParamSchema = z.object({
  ruleId: z.string().min(1),
});
export const notificationLogIdParamSchema = z.object({
  logId: z.string().min(1),
});

export const createNotificationTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    eventKey: z.string().trim().min(1).max(160),
    channel: z.enum(["EMAIL", "SMS", "IN_APP", "PUSH", "WEBHOOK"]).optional(),
    subject: z.string().trim().max(500).nullable().optional(),
    body: z.string().min(1).max(100000),
    format: z.enum(["TEXT", "HTML"]).optional(),
    locale: z.string().trim().min(2).max(10).optional(),
    isEnabled: z.boolean().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
  })
  .strict();
export const updateNotificationTemplateSchema = createNotificationTemplateSchema
  .partial()
  .strict();

export const createNotificationRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    eventKey: z.string().trim().min(1).max(160),
    templateId: z.string().min(1).nullable().optional(),
    channel: z.enum(["EMAIL", "SMS", "IN_APP", "PUSH", "WEBHOOK"]).optional(),
    recipients: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
    conditions: z.record(z.string(), z.unknown()).optional(),
    isEnabled: z.boolean().optional(),
  })
  .strict();
export const updateNotificationRuleSchema = createNotificationRuleSchema
  .partial()
  .strict();
