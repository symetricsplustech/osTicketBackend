import { z } from 'zod';

export const EMAIL_PROVIDER_TYPES = ['SMTP', 'SENDGRID', 'MAILGUN', 'RESEND', 'POSTMARK'] as const;

export type EmailProviderTypeValue = (typeof EMAIL_PROVIDER_TYPES)[number];

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Key must be at least 2 characters.')
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, 'Key must contain only lowercase letters, numbers and hyphens.');

const channelEnum = z.enum(['EMAIL', 'IN_APP', 'SMS']);

const bodyFormatEnum = z.enum(['HTML', 'TEXT']);

const templateStatusEnum = z.enum(['DRAFT', 'ENABLED', 'DISABLED']);

interface ConfigRequirement {
  key: string;
  message: string;
  validate?: (value: unknown) => boolean;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidPort(value: unknown): boolean {
  const numeric = typeof value === 'number' ? value : Number(String(value));
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 65535;
}

const PROVIDER_CONFIG_REQUIREMENTS: Record<EmailProviderTypeValue, ConfigRequirement[]> = {
  SMTP: [
    { key: 'host', message: 'An SMTP host is required.', validate: isNonEmptyString },
    { key: 'port', message: 'A valid SMTP port (1-65535) is required.', validate: isValidPort },
  ],
  SENDGRID: [{ key: 'apiKey', message: 'A SendGrid API key is required.', validate: isNonEmptyString }],
  MAILGUN: [
    { key: 'apiKey', message: 'A Mailgun API key is required.', validate: isNonEmptyString },
    { key: 'domain', message: 'A Mailgun sending domain is required.', validate: isNonEmptyString },
  ],
  RESEND: [{ key: 'apiKey', message: 'A Resend API key is required.', validate: isNonEmptyString }],
  POSTMARK: [{ key: 'serverToken', message: 'A Postmark server token is required.', validate: isNonEmptyString }],
};

export interface ProviderConfigIssue {
  key: string;
  message: string;
}

export function validateProviderConfig(providerType: string, config: Record<string, unknown>): ProviderConfigIssue[] {
  const requirements = PROVIDER_CONFIG_REQUIREMENTS[providerType as EmailProviderTypeValue] ?? [];
  const issues: ProviderConfigIssue[] = [];
  for (const requirement of requirements) {
    const value = config[requirement.key];
    const present = value !== undefined && value !== null && String(value).trim() !== '';
    if (!present || !(requirement.validate ? requirement.validate(value) : true)) {
      issues.push({ key: requirement.key, message: requirement.message });
    }
  }
  return issues;
}

const providerConfigSchema = z
  .record(z.unknown())
  .refine((value) => Object.keys(value).length > 0, 'Provider configuration must contain at least one key.');

export const createProviderSchema = z
  .object({
    key: slugField,
    name: z.string().trim().min(2, 'Provider name must be at least 2 characters.').max(120),
    providerType: z.enum(EMAIL_PROVIDER_TYPES),
    fromEmail: z.string().trim().email('A valid sender email is required.'),
    fromName: z.string().trim().max(120).optional(),
    replyTo: z.string().trim().email('Reply-to must be a valid email address.').optional(),
    isDefault: z.boolean().optional().default(false),
    config: providerConfigSchema,
  })
  .superRefine((value, ctx) => {
    for (const issue of validateProviderConfig(value.providerType, value.config)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['config', issue.key], message: issue.message });
    }
  });

export const updateProviderSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  fromEmail: z.string().trim().email('A valid sender email is required.').optional(),
  fromName: z.string().trim().max(120).nullable().optional(),
  replyTo: z.string().trim().email('Reply-to must be a valid email address.').nullable().optional(),
  isDefault: z.boolean().optional(),
  config: providerConfigSchema.optional(),
});

export const providerIdParamSchema = z.object({
  providerId: z.string().min(1, 'Provider identifier is required.'),
});

export const testProviderSchema = z.object({
  to: z.string().trim().email('A valid recipient email is required.'),
});

const templateVariableSchema = z.object({
  name: z.string().trim().min(1, 'Variable name is required.').max(80),
  description: z.string().trim().max(300).optional(),
  required: z.boolean().optional(),
});

const notificationTemplateFields = {
  key: slugField,
  name: z.string().trim().min(2, 'Template name must be at least 2 characters.').max(120),
  description: z.string().trim().max(1000).optional(),
  channel: channelEnum.optional().default('EMAIL'),
  subject: z.string().trim().max(300).optional(),
  body: z.string().min(1, 'Template body is required.').max(100_000),
  bodyFormat: bodyFormatEnum.optional().default('HTML'),
  variables: z.array(templateVariableSchema).max(100).optional(),
  status: templateStatusEnum.optional().default('DRAFT'),
};

export const createTemplateSchema = z.object(notificationTemplateFields).superRefine((value, ctx) => {
  if (value.channel === 'EMAIL' && !value.subject) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['subject'],
      message: 'A subject is required for email templates.',
    });
  }
});

export const updateTemplateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    channel: channelEnum.optional(),
    subject: z.string().trim().max(300).nullable().optional(),
    body: z.string().min(1, 'Template body is required.').max(100_000).optional(),
    bodyFormat: bodyFormatEnum.optional(),
    variables: z.array(templateVariableSchema).max(100).nullable().optional(),
    status: templateStatusEnum.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.channel === 'EMAIL' && value.subject === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subject'],
        message: 'Email templates require a subject.',
      });
    }
  });

export const templateIdParamSchema = z.object({
  templateId: z.string().min(1, 'Template identifier is required.'),
});

export const previewTemplateSchema = z.object({
  variables: z.record(z.unknown()).optional().default({}),
});

const ruleRecipientsSchema = z
  .object({
    roles: z.array(z.string().trim().min(1)).max(50).optional(),
    emails: z.array(z.string().trim().email('Recipient emails must be valid.')).max(100).optional(),
    includeRequester: z.boolean().optional(),
  })
  .refine(
    (value) => (value.roles?.length ?? 0) > 0 || (value.emails?.length ?? 0) > 0 || value.includeRequester === true,
    'At least one recipient (role, email or the requester) is required.',
  );

const notificationRuleFields = {
  name: z.string().trim().min(2, 'Rule name must be at least 2 characters.').max(120),
  eventKey: z.string().trim().min(1, 'An event key is required.').max(120),
  channel: channelEnum.optional().default('EMAIL'),
  templateId: z.string().min(1).optional(),
  conditions: z.record(z.unknown()).optional(),
  recipients: ruleRecipientsSchema,
  isEnabled: z.boolean().optional().default(true),
  priority: z.number().int().min(0).max(10000).optional().default(100),
};

export const createRuleSchema = z.object(notificationRuleFields);

export const updateRuleSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  eventKey: z.string().trim().min(1).max(120).optional(),
  channel: channelEnum.optional(),
  templateId: z.string().min(1).nullable().optional(),
  conditions: z.record(z.unknown()).nullable().optional(),
  recipients: ruleRecipientsSchema.optional(),
  isEnabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(10000).optional(),
});

export const ruleIdParamSchema = z.object({
  ruleId: z.string().min(1, 'Rule identifier is required.'),
});

export const deliveryLogIdParamSchema = z.object({
  deliveryId: z.string().min(1, 'Delivery identifier is required.'),
});

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type TestProviderInput = z.infer<typeof testProviderSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;
export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
