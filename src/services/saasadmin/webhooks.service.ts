import type { Request } from 'express';
import { Prisma, type Webhook, type WebhookDelivery, type WebhookDeliveryStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { BadRequestError, NotFoundError, PreconditionFailedError, ValidationError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import { encryptSecret } from '../../shared/encryption';
import { randomToken } from '../../shared/utils/crypto';
import { truncate } from '../../shared/utils/sanitize';
import { assertSafeOutboundUrl } from '../../shared/webhooks/ssrf';
import { dispatchDelivery, queueWebhookDelivery } from '../../shared/webhooks/dispatcher';
import type {
  CreateWebhookInput,
  TestWebhookInput,
  UpdateWebhookInput,
} from '../../validators/saasadmin/webhooks.validators';

export interface WebhookActor {
  actorId?: string | null;
  req?: Request;
}

const WEBHOOK_DELIVERY_STATUSES = ['PENDING', 'SUCCESS', 'FAILED'] as const;

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

function eventKeysOf(webhook: Webhook): string[] {
  return Array.isArray(webhook.eventKeys) ? webhook.eventKeys.map(String) : [];
}

function toWebhookSafe(webhook: Webhook) {
  return {
    id: webhook.id,
    name: webhook.name,
    description: webhook.description,
    url: webhook.url,
    eventKeys: eventKeysOf(webhook),
    isEnabled: webhook.isEnabled,
    failureCount: webhook.failureCount,
    lastDeliveryAt: webhook.lastDeliveryAt,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
  };
}

function toDeliverySafe(delivery: WebhookDelivery) {
  return {
    id: delivery.id,
    webhookId: delivery.webhookId,
    eventKey: delivery.eventKey,
    status: delivery.status,
    attempts: delivery.attempts,
    responseStatus: delivery.responseStatus,
    lastError: delivery.lastError,
    nextRetryAt: delivery.nextRetryAt,
    deliveredAt: delivery.deliveredAt,
    isTest: delivery.isTest,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
  };
}

function toDeliveryDetail(delivery: WebhookDelivery) {
  return {
    ...toDeliverySafe(delivery),
    payload: delivery.payload,
    responseBody: delivery.responseBody ? truncate(delivery.responseBody, 2000) : null,
  };
}

async function assertPublicWebhookUrl(url: string): Promise<void> {
  try {
    await assertSafeOutboundUrl(url, { allowHttp: env.NODE_ENV !== 'production' });
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw new ValidationError(error.message, [{ field: 'url', message: error.message, code: 'INVALID_URL' }]);
    }
    throw error;
  }
}

export async function listWebhooks(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const isEnabled = queryBoolean(query.isEnabled);

  const where: Prisma.WebhookWhereInput = {
    ...(isEnabled !== undefined ? { isEnabled } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { url: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.webhook.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
    prisma.webhook.count({ where }),
  ]);

  const ids = rows.map((row) => row.id);
  const grouped = ids.length
    ? await prisma.webhookDelivery.groupBy({
        by: ['webhookId', 'status'],
        where: { webhookId: { in: ids } },
        _count: { _all: true },
      })
    : [];

  const countsByWebhook = new Map<string, Record<WebhookDeliveryStatus, number>>();
  for (const entry of grouped) {
    const record = countsByWebhook.get(entry.webhookId) ?? { PENDING: 0, SUCCESS: 0, FAILED: 0 };
    record[entry.status] = entry._count._all;
    countsByWebhook.set(entry.webhookId, record);
  }

  return {
    rows: rows.map((row) => ({
      ...toWebhookSafe(row),
      deliveryCounts: countsByWebhook.get(row.id) ?? { PENDING: 0, SUCCESS: 0, FAILED: 0 },
    })),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function createWebhook(input: CreateWebhookInput, actor: WebhookActor) {
  await assertPublicWebhookUrl(input.url);

  const secret = randomToken(32);
  const webhook = await prisma.webhook.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      url: input.url,
      eventKeys: input.eventKeys as unknown as Prisma.InputJsonValue,
      secretEnc: encryptSecret(secret),
      isEnabled: input.isEnabled,
      createdById: actor.actorId ?? null,
    },
  });

  await recordAudit({
    action: 'webhook.created',
    resourceType: 'webhook',
    resourceId: webhook.id,
    after: toWebhookSafe(webhook),
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return { webhook: toWebhookSafe(webhook), secret };
}

export async function getWebhook(webhookId: string) {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
    include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });
  if (!webhook) throw new NotFoundError('Webhook');

  return {
    ...toWebhookSafe(webhook),
    recentDeliveries: webhook.deliveries.map(toDeliverySafe),
  };
}

export async function updateWebhook(webhookId: string, input: UpdateWebhookInput, actor: WebhookActor) {
  const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
  if (!webhook) throw new NotFoundError('Webhook');

  if (input.url !== undefined) await assertPublicWebhookUrl(input.url);

  const data: Prisma.WebhookUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.url !== undefined) data.url = input.url;
  if (input.eventKeys !== undefined) data.eventKeys = input.eventKeys as unknown as Prisma.InputJsonValue;
  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;

  const updated = await prisma.webhook.update({ where: { id: webhookId }, data });

  await recordAudit({
    action: 'webhook.updated',
    resourceType: 'webhook',
    resourceId: webhookId,
    before: toWebhookSafe(webhook),
    after: toWebhookSafe(updated),
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return toWebhookSafe(updated);
}

export async function testWebhook(webhookId: string, input: TestWebhookInput, actor: WebhookActor) {
  const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
  if (!webhook) throw new NotFoundError('Webhook');

  const eventKey = input.eventKey ?? eventKeysOf(webhook).find((key) => key !== '*') ?? 'webhook.test';

  const deliveryId = await queueWebhookDelivery({
    webhookId: webhook.id,
    eventKey,
    payload: { message: 'Test delivery from the platform', webhookId: webhook.id },
    isTest: true,
  });
  await dispatchDelivery(deliveryId);

  const delivery = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new NotFoundError('Webhook delivery');

  await recordAudit({
    action: 'webhook.tested',
    resourceType: 'webhook',
    resourceId: webhook.id,
    outcome: delivery.status === 'SUCCESS' ? 'SUCCESS' : 'FAILURE',
    metadata: { deliveryId, eventKey, status: delivery.status, responseStatus: delivery.responseStatus },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  void publishEvent({
    eventKey: 'webhook.test',
    payload: { webhookId: webhook.id, deliveryId, status: delivery.status },
  });

  return toDeliverySafe(delivery);
}

export async function setWebhookEnabled(webhookId: string, isEnabled: boolean, actor: WebhookActor) {
  const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
  if (!webhook) throw new NotFoundError('Webhook');

  const updated = await prisma.webhook.update({ where: { id: webhookId }, data: { isEnabled } });

  await recordAudit({
    action: isEnabled ? 'webhook.enabled' : 'webhook.disabled',
    resourceType: 'webhook',
    resourceId: webhookId,
    before: { isEnabled: webhook.isEnabled },
    after: { isEnabled: updated.isEnabled },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return toWebhookSafe(updated);
}

export async function rotateWebhookSecret(webhookId: string, actor: WebhookActor) {
  const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
  if (!webhook) throw new NotFoundError('Webhook');

  const secret = randomToken(32);
  const updated = await prisma.webhook.update({
    where: { id: webhookId },
    data: { secretEnc: encryptSecret(secret) },
  });

  await recordAudit({
    action: 'webhook.secret.rotated',
    resourceType: 'webhook',
    resourceId: webhookId,
    metadata: { rotatedAt: new Date().toISOString() },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return { webhook: toWebhookSafe(updated), secret };
}

export async function listWebhookDeliveries(webhookId: string, req: Request) {
  const webhook = await prisma.webhook.findUnique({ where: { id: webhookId }, select: { id: true } });
  if (!webhook) throw new NotFoundError('Webhook');

  const query = parseListQuery(req, { maxLimit: 100 });
  const status = pickEnum(query.status, WEBHOOK_DELIVERY_STATUSES);

  const where: Prisma.WebhookDeliveryWhereInput = {
    webhookId,
    ...(status ? { status } : {}),
    ...(query.eventKey ? { eventKey: String(query.eventKey) } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.webhookDelivery.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
    prisma.webhookDelivery.count({ where }),
  ]);

  return { rows: rows.map(toDeliverySafe), meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getWebhookDelivery(webhookId: string, deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findFirst({ where: { id: deliveryId, webhookId } });
  if (!delivery) throw new NotFoundError('Webhook delivery');
  return toDeliveryDetail(delivery);
}

export async function retryWebhookDelivery(webhookId: string, deliveryId: string, actor: WebhookActor) {
  const delivery = await prisma.webhookDelivery.findFirst({ where: { id: deliveryId, webhookId } });
  if (!delivery) throw new NotFoundError('Webhook delivery');
  if (delivery.status !== 'FAILED') {
    throw new PreconditionFailedError('Only failed deliveries can be retried.');
  }

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: { status: 'PENDING', nextRetryAt: null, lastError: null },
  });
  await dispatchDelivery(delivery.id);

  const refreshed = await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } });
  if (!refreshed) throw new NotFoundError('Webhook delivery');

  await recordAudit({
    action: 'webhook.delivery.retried',
    resourceType: 'webhook',
    resourceId: webhookId,
    outcome: refreshed.status === 'SUCCESS' ? 'SUCCESS' : 'FAILURE',
    metadata: { deliveryId: refreshed.id, status: refreshed.status, attempts: refreshed.attempts },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return toDeliveryDetail(refreshed);
}

export { toWebhookSafe, toDeliverySafe, toDeliveryDetail };
