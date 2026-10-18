import type { Request } from 'express';
import { Prisma, type DeliveryLog, type EmailProvider } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { decryptJson, encryptJson } from '../../shared/encryption';
import { maskConfig, sendEmail, verifyEmailProvider } from '../../shared/email';
import { emailTemplates, renderTemplate } from '../../shared/email/templates';
import { truncate } from '../../shared/utils/sanitize';
import { validateProviderConfig } from '../../validators/saasadmin/email-notifications.validators';
import type {
  CreateProviderInput,
  CreateRuleInput,
  CreateTemplateInput,
  PreviewTemplateInput,
  TestProviderInput,
  UpdateProviderInput,
  UpdateRuleInput,
  UpdateTemplateInput,
} from '../../validators/saasadmin/email-notifications.validators';

export interface EmailNotificationActor {
  actorId?: string | null;
  req?: Request;
}

const PROVIDER_STATUSES = ['UNVERIFIED', 'ACTIVE', 'DISABLED', 'ERROR'] as const;
const TEMPLATE_STATUSES = ['DRAFT', 'ENABLED', 'DISABLED'] as const;
const DELIVERY_STATUSES = ['QUEUED', 'SENT', 'FAILED', 'BOUNCED', 'SUPPRESSED'] as const;

function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function queryBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalised = String(value).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalised)) return true;
  if (['false', '0', 'no', 'off'].includes(normalised)) return false;
  return undefined;
}

function parseDateFilter(value: unknown): Date | undefined {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function providerConfigKeys(configEnc: string): string[] {
  try {
    return Object.keys(maskConfig(decryptJson<Record<string, unknown>>(configEnc)));
  } catch {
    return [];
  }
}

function toProviderSafe(provider: EmailProvider) {
  return {
    id: provider.id,
    key: provider.key,
    name: provider.name,
    providerType: provider.providerType,
    fromEmail: provider.fromEmail,
    fromName: provider.fromName,
    replyTo: provider.replyTo,
    status: provider.status,
    isDefault: provider.isDefault,
    lastTestedAt: provider.lastTestedAt,
    lastTestResult: provider.lastTestResult,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
    config: { configuredKeys: providerConfigKeys(provider.configEnc) },
  };
}

function declaredVariables(variables: Prisma.JsonValue): { name: string; required: boolean }[] {
  if (!Array.isArray(variables)) return [];
  const declared: { name: string; required: boolean }[] = [];
  for (const entry of variables) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    if (record['name'] === undefined || record['name'] === null) continue;
    declared.push({ name: String(record['name']), required: record['required'] === true });
  }
  return declared;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export async function listProviders(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const status = pickEnum(query.status, PROVIDER_STATUSES);
  const isDefault = queryBoolean(query.isDefault);

  const where: Prisma.EmailProviderWhereInput = {
    ...(query.search
      ? {
          OR: [
            { key: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
            { fromEmail: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(query.providerType ? { providerType: String(query.providerType) } : {}),
    ...(isDefault !== undefined ? { isDefault } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.emailProvider.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
    prisma.emailProvider.count({ where }),
  ]);

  return { rows: rows.map(toProviderSafe), meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function createProvider(input: CreateProviderInput, actor: EmailNotificationActor) {
  const issues = validateProviderConfig(input.providerType, input.config);
  if (issues.length > 0) {
    throw new ValidationError(
      'Provider configuration is incomplete.',
      issues.map((issue) => ({ field: `config.${issue.key}`, message: issue.message, code: 'INVALID_CONFIG' })),
    );
  }

  const existing = await prisma.emailProvider.findUnique({ where: { key: input.key } });
  if (existing) throw new ConflictError(`An email provider with the key "${input.key}" already exists.`);

  const provider = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.emailProvider.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.emailProvider.create({
      data: {
        key: input.key,
        name: input.name,
        providerType: input.providerType,
        fromEmail: input.fromEmail,
        fromName: input.fromName ?? null,
        replyTo: input.replyTo ?? null,
        configEnc: encryptJson(input.config),
        isDefault: input.isDefault,
        createdById: actor.actorId ?? null,
      },
    });
  });

  await recordAudit({
    action: 'email.provider.created',
    resourceType: 'email-provider',
    resourceId: provider.id,
    after: toProviderSafe(provider),
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return toProviderSafe(provider);
}

export async function getProvider(providerId: string) {
  const provider = await prisma.emailProvider.findUnique({ where: { id: providerId } });
  if (!provider) throw new NotFoundError('Email provider');
  return toProviderSafe(provider);
}

export async function updateProvider(providerId: string, input: UpdateProviderInput, actor: EmailNotificationActor) {
  const provider = await prisma.emailProvider.findUnique({ where: { id: providerId } });
  if (!provider) throw new NotFoundError('Email provider');

  const data: Prisma.EmailProviderUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.fromEmail !== undefined) data.fromEmail = input.fromEmail;
  if (input.fromName !== undefined) data.fromName = input.fromName;
  if (input.replyTo !== undefined) data.replyTo = input.replyTo;
  if (input.isDefault !== undefined) data.isDefault = input.isDefault;

  if (input.config !== undefined) {
    const existingConfig = decryptJson<Record<string, unknown>>(provider.configEnc);
    const merged = { ...existingConfig, ...input.config };
    const issues = validateProviderConfig(provider.providerType, merged);
    if (issues.length > 0) {
      throw new ValidationError(
        'Provider configuration is incomplete.',
        issues.map((issue) => ({ field: `config.${issue.key}`, message: issue.message, code: 'INVALID_CONFIG' })),
      );
    }
    data.configEnc = encryptJson(merged);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.emailProvider.updateMany({
        where: { isDefault: true, id: { not: providerId } },
        data: { isDefault: false },
      });
    }
    return tx.emailProvider.update({ where: { id: providerId }, data });
  });

  await recordAudit({
    action: 'email.provider.updated',
    resourceType: 'email-provider',
    resourceId: providerId,
    before: toProviderSafe(provider),
    after: toProviderSafe(updated),
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return toProviderSafe(updated);
}

export async function testProvider(providerId: string, input: TestProviderInput, actor: EmailNotificationActor) {
  const provider = await prisma.emailProvider.findUnique({ where: { id: providerId } });
  if (!provider) throw new NotFoundError('Email provider');

  const message = emailTemplates.testMessage({ providerName: provider.name });
  const result = await sendEmail({
    to: input.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    providerId: provider.id,
    metadata: { source: 'provider-test', providerId: provider.id },
  });

  const success = result.status === 'SENT';
  const updated = await prisma.emailProvider.update({
    where: { id: providerId },
    data: {
      lastTestedAt: new Date(),
      lastTestResult: truncate(result.error ?? result.status, 500),
      status: success ? 'ACTIVE' : 'ERROR',
    },
  });

  await recordAudit({
    action: 'email.provider.tested',
    resourceType: 'email-provider',
    resourceId: providerId,
    outcome: success ? 'SUCCESS' : 'FAILURE',
    metadata: {
      deliveryId: result.deliveryId,
      deliveryStatus: result.status,
      error: result.error ? truncate(result.error, 300) : undefined,
    },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return {
    sent: success,
    deliveryId: result.deliveryId,
    error: result.error ?? null,
    providerStatus: updated.status,
  };
}

export async function verifyProvider(providerId: string, actor: EmailNotificationActor) {
  const provider = await prisma.emailProvider.findUnique({ where: { id: providerId } });
  if (!provider) throw new NotFoundError('Email provider');

  const result = await verifyEmailProvider(provider);
  const updated = await prisma.emailProvider.update({
    where: { id: providerId },
    data: {
      status: result.ok ? 'ACTIVE' : 'ERROR',
      lastTestedAt: new Date(),
      lastTestResult: truncate(result.message, 500),
    },
  });

  await recordAudit({
    action: 'email.provider.verified',
    resourceType: 'email-provider',
    resourceId: providerId,
    outcome: result.ok ? 'SUCCESS' : 'FAILURE',
    metadata: { message: truncate(result.message, 300) },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return { ok: result.ok, message: result.message, status: updated.status };
}

export async function disableProvider(providerId: string, actor: EmailNotificationActor) {
  const provider = await prisma.emailProvider.findUnique({ where: { id: providerId } });
  if (!provider) throw new NotFoundError('Email provider');

  const updated = await prisma.emailProvider.update({
    where: { id: providerId },
    data: { status: 'DISABLED' },
  });

  await recordAudit({
    action: 'email.provider.disabled',
    resourceType: 'email-provider',
    resourceId: providerId,
    before: { status: provider.status },
    after: { status: updated.status },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return toProviderSafe(updated);
}

export async function listTemplates(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const status = pickEnum(query.status, TEMPLATE_STATUSES);

  const where: Prisma.NotificationTemplateWhereInput = {
    ...(query.search
      ? {
          OR: [
            { key: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(query.channel ? { channel: String(query.channel) } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.notificationTemplate.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
    prisma.notificationTemplate.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function createTemplate(input: CreateTemplateInput, actor: EmailNotificationActor) {
  if (input.channel === 'EMAIL' && (!input.subject || !input.subject.trim())) {
    throw new ValidationError('Email templates require a subject.', [
      { field: 'subject', message: 'A subject is required for email templates.', code: 'REQUIRED' },
    ]);
  }

  const existing = await prisma.notificationTemplate.findUnique({ where: { key: input.key } });
  if (existing) throw new ConflictError(`A notification template with the key "${input.key}" already exists.`);

  const template = await prisma.notificationTemplate.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      channel: input.channel,
      subject: input.subject ?? null,
      body: input.body,
      bodyFormat: input.bodyFormat,
      variables: input.variables !== undefined ? (input.variables as unknown as Prisma.InputJsonValue) : undefined,
      status: input.status,
    },
  });

  await recordAudit({
    action: 'notification.template.created',
    resourceType: 'notification-template',
    resourceId: template.id,
    after: template,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return template;
}

export async function getTemplate(templateId: string) {
  const template = await prisma.notificationTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new NotFoundError('Notification template');
  return template;
}

export async function updateTemplate(templateId: string, input: UpdateTemplateInput, actor: EmailNotificationActor) {
  const template = await prisma.notificationTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new NotFoundError('Notification template');

  const nextChannel = input.channel ?? template.channel;
  const nextSubject = input.subject !== undefined ? input.subject : template.subject;
  if (nextChannel === 'EMAIL' && (!nextSubject || !nextSubject.trim())) {
    throw new ValidationError('Email templates require a subject.', [
      { field: 'subject', message: 'A subject is required for email templates.', code: 'REQUIRED' },
    ]);
  }

  const data: Prisma.NotificationTemplateUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.channel !== undefined) data.channel = input.channel;
  if (input.subject !== undefined) data.subject = input.subject;
  if (input.body !== undefined) data.body = input.body;
  if (input.bodyFormat !== undefined) data.bodyFormat = input.bodyFormat;
  if (input.status !== undefined) data.status = input.status;
  if (input.variables !== undefined) {
    data.variables =
      input.variables === null ? Prisma.DbNull : (input.variables as unknown as Prisma.InputJsonValue);
  }

  const updated = await prisma.notificationTemplate.update({ where: { id: templateId }, data });

  await recordAudit({
    action: 'notification.template.updated',
    resourceType: 'notification-template',
    resourceId: templateId,
    before: template,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function previewTemplate(templateId: string, input: PreviewTemplateInput) {
  const template = await prisma.notificationTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new NotFoundError('Notification template');

  const variables = input.variables ?? {};
  const declared = declaredVariables(template.variables);
  const missingVariables = declared
    .filter((entry) => entry.required && !hasValue(variables[entry.name]))
    .map((entry) => entry.name);

  return {
    subject: template.subject ? renderTemplate(template.subject, variables) : null,
    body: renderTemplate(template.body, variables),
    missingVariables,
  };
}

export async function listRules(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const isEnabled = queryBoolean(query.isEnabled);

  const where: Prisma.NotificationRuleWhereInput = {
    ...(query.eventKey ? { eventKey: String(query.eventKey) } : {}),
    ...(query.channel ? { channel: String(query.channel) } : {}),
    ...(isEnabled !== undefined ? { isEnabled } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { eventKey: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.notificationRule.findMany({
      where,
      include: { template: { select: { id: true, key: true, name: true } } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      ...paginationArgs(query),
    }),
    prisma.notificationRule.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function createRule(input: CreateRuleInput, actor: EmailNotificationActor) {
  if (input.templateId) {
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: input.templateId },
      select: { id: true },
    });
    if (!template) throw new NotFoundError('Notification template');
  }

  const rule = await prisma.notificationRule.create({
    data: {
      name: input.name,
      eventKey: input.eventKey,
      channel: input.channel,
      templateId: input.templateId ?? null,
      conditions: input.conditions !== undefined ? (input.conditions as unknown as Prisma.InputJsonValue) : undefined,
      recipients: input.recipients as unknown as Prisma.InputJsonValue,
      isEnabled: input.isEnabled,
      priority: input.priority,
    },
    include: { template: { select: { id: true, key: true, name: true } } },
  });

  await recordAudit({
    action: 'notification.rule.created',
    resourceType: 'notification-rule',
    resourceId: rule.id,
    after: rule,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return rule;
}

export async function updateRule(ruleId: string, input: UpdateRuleInput, actor: EmailNotificationActor) {
  const rule = await prisma.notificationRule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new NotFoundError('Notification rule');

  if (input.templateId) {
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: input.templateId },
      select: { id: true },
    });
    if (!template) throw new NotFoundError('Notification template');
  }

  const data: Prisma.NotificationRuleUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.eventKey !== undefined) data.eventKey = input.eventKey;
  if (input.channel !== undefined) data.channel = input.channel;
  if (input.templateId !== undefined) data.templateId = input.templateId;
  if (input.conditions !== undefined) {
    data.conditions =
      input.conditions === null ? Prisma.DbNull : (input.conditions as unknown as Prisma.InputJsonValue);
  }
  if (input.recipients !== undefined) data.recipients = input.recipients as unknown as Prisma.InputJsonValue;
  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;
  if (input.priority !== undefined) data.priority = input.priority;

  const updated = await prisma.notificationRule.update({
    where: { id: ruleId },
    data,
    include: { template: { select: { id: true, key: true, name: true } } },
  });

  await recordAudit({
    action: 'notification.rule.updated',
    resourceType: 'notification-rule',
    resourceId: ruleId,
    before: rule,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function setRuleEnabled(ruleId: string, isEnabled: boolean, actor: EmailNotificationActor) {
  const rule = await prisma.notificationRule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new NotFoundError('Notification rule');
  if (rule.isEnabled === isEnabled) return rule;

  const updated = await prisma.notificationRule.update({
    where: { id: ruleId },
    data: { isEnabled },
    include: { template: { select: { id: true, key: true, name: true } } },
  });

  await recordAudit({
    action: isEnabled ? 'notification.rule.enabled' : 'notification.rule.disabled',
    resourceType: 'notification-rule',
    resourceId: ruleId,
    before: { isEnabled: rule.isEnabled },
    after: { isEnabled: updated.isEnabled },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listDeliveryLogs(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const status = pickEnum(query.status, DELIVERY_STATUSES);
  const from = parseDateFilter(query['from']);
  const to = parseDateFilter(query['to']);

  const where: Prisma.DeliveryLogWhereInput = {
    ...(status ? { status } : {}),
    ...(query.channel ? { channel: String(query.channel) } : {}),
    ...(query.search
      ? {
          OR: [
            { recipient: { contains: query.search, mode: 'insensitive' } },
            { subject: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.deliveryLog.findMany({
      where,
      include: {
        provider: { select: { id: true, key: true, name: true } },
        template: { select: { id: true, key: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...paginationArgs(query),
    }),
    prisma.deliveryLog.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getDeliveryLog(deliveryId: string) {
  const log = await prisma.deliveryLog.findUnique({
    where: { id: deliveryId },
    include: {
      provider: { select: { id: true, key: true, name: true } },
      template: { select: { id: true, key: true, name: true } },
    },
  });
  if (!log) throw new NotFoundError('Delivery log');
  return toDeliveryLogSafe(log);
}

function toDeliveryLogSafe(log: DeliveryLog & {
  provider: { id: string; key: string; name: string } | null;
  template: { id: string; key: string; name: string } | null;
}) {
  return {
    id: log.id,
    providerId: log.providerId,
    ruleId: log.ruleId,
    templateId: log.templateId,
    channel: log.channel,
    recipient: log.recipient,
    subject: log.subject,
    status: log.status,
    attempts: log.attempts,
    lastError: log.lastError ? truncate(log.lastError, 500) : null,
    payloadMeta: log.payloadMeta,
    sentAt: log.sentAt,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
    provider: log.provider,
    template: log.template,
  };
}

export { toProviderSafe, toDeliveryLogSafe };
