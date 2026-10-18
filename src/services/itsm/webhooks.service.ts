import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { decryptSecret, encryptSecret } from '../../shared/encryption';
import { hmacSha256, randomToken } from '../../shared/utils/crypto';
import { assertSafeOutboundUrl } from '../../shared/webhooks/ssrf';
import { redactObject, truncate } from '../../shared/utils/sanitize';
import type { TenantActorContext } from '../tenantadmin/roles.service';

const TEST_TIMEOUT_MS = 10_000;

type WebhookRow = {
  id: string;
  name: string;
  description: string | null;
  url: string;
  eventKeys: unknown;
  isEnabled: boolean;
  failureCount: number;
  lastDeliveryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toSafe(webhook: WebhookRow) {
  return {
    id: webhook.id,
    name: webhook.name,
    description: webhook.description,
    url: webhook.url,
    eventKeys: webhook.eventKeys,
    isEnabled: webhook.isEnabled,
    failureCount: webhook.failureCount,
    lastDeliveryAt: webhook.lastDeliveryAt,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
  };
}

function toDeliverySafe(delivery: {
  id: string;
  webhookId: string;
  eventKey: string;
  payload: unknown;
  status: string;
  responseStatus: number | null;
  responseBody: string | null;
  attempts: number;
  nextRetryAt: Date | null;
  lastError: string | null;
  isTest: boolean;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: delivery.id,
    webhookId: delivery.webhookId,
    eventKey: delivery.eventKey,
    payload: redactObject(delivery.payload),
    status: delivery.status,
    responseStatus: delivery.responseStatus,
    responseBody: delivery.responseBody,
    attempts: delivery.attempts,
    nextRetryAt: delivery.nextRetryAt,
    lastError: delivery.lastError,
    isTest: delivery.isTest,
    deliveredAt: delivery.deliveredAt,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
  };
}

export const webhookService = {
  async list(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 100 });
    const where: Prisma.TenantWebhookWhereInput = { tenantId, deletedAt: null };
    if (typeof query.isEnabled !== 'undefined') {
      const raw = String(query.isEnabled).toLowerCase();
      if (['true', '1', 'yes'].includes(raw)) where.isEnabled = true;
      if (['false', '0', 'no'].includes(raw)) where.isEnabled = false;
    }
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    const [rows, total] = await Promise.all([
      prisma.tenantWebhook.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      prisma.tenantWebhook.count({ where }),
    ]);
    return { rows: rows.map(toSafe), meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async get(tenantId: string, id: string) {
    const webhook = await prisma.tenantWebhook.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!webhook) throw new NotFoundError('Webhook');
    return { ...toSafe(webhook), recentDeliveries: webhook.deliveries.map(toDeliverySafe) };
  },

  async create(tenantId: string, input: Record<string, unknown>, actor: TenantActorContext) {
    await assertSafeOutboundUrl(String(input.url), { allowHttp: env.NODE_ENV !== 'production' });
    const dup = await prisma.tenantWebhook.findFirst({ where: { tenantId, name: String(input.name), deletedAt: null }, select: { id: true } });
    if (dup) throw new ConflictError('A webhook with this name already exists in the organization.');
    const secret = randomToken(32);
    const webhook = await prisma.tenantWebhook.create({
      data: {
        tenantId,
        name: String(input.name),
        description: (input.description as string) ?? null,
        url: String(input.url),
        eventKeys: (input.eventKeys as Prisma.InputJsonValue) ?? [],
        secretEnc: encryptSecret(secret),
        isEnabled: input.isEnabled === undefined ? true : input.isEnabled === true,
        createdById: actor.actorId ?? null,
      },
    });
    await recordAudit({
      action: 'webhook.created',
      resourceType: 'webhook',
      resourceId: webhook.id,
      tenantId,
      after: toSafe(webhook),
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return { ...toSafe(webhook), secret };
  },

  async update(tenantId: string, id: string, input: Record<string, unknown>, actor: TenantActorContext) {
    const existing = await prisma.tenantWebhook.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw new NotFoundError('Webhook');
    if (typeof input.url === 'string') await assertSafeOutboundUrl(input.url, { allowHttp: env.NODE_ENV !== 'production' });
    if (typeof input.name === 'string' && input.name !== existing.name) {
      const dup = await prisma.tenantWebhook.findFirst({ where: { tenantId, name: input.name, deletedAt: null, id: { not: id } }, select: { id: true } });
      if (dup) throw new ConflictError('A webhook with this name already exists in the organization.');
    }
    const data: Prisma.TenantWebhookUpdateInput = {};
    if (input.name !== undefined) data.name = String(input.name);
    if (input.description !== undefined) data.description = input.description as string;
    if (input.url !== undefined) data.url = String(input.url);
    if (input.eventKeys !== undefined) data.eventKeys = input.eventKeys as Prisma.InputJsonValue;
    if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled === true;
    const webhook = await prisma.tenantWebhook.update({ where: { id }, data });
    await recordAudit({
      action: 'webhook.updated',
      resourceType: 'webhook',
      resourceId: id,
      tenantId,
      before: toSafe(existing),
      after: toSafe(webhook),
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return toSafe(webhook);
  },

  async remove(tenantId: string, id: string, actor: TenantActorContext) {
    const existing = await prisma.tenantWebhook.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw new NotFoundError('Webhook');
    await prisma.tenantWebhook.update({ where: { id }, data: { deletedAt: new Date() } });
    await recordAudit({
      action: 'webhook.deleted',
      resourceType: 'webhook',
      resourceId: id,
      tenantId,
      before: toSafe(existing),
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
  },

  async setEnabled(tenantId: string, id: string, isEnabled: boolean, actor: TenantActorContext) {
    const existing = await prisma.tenantWebhook.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw new NotFoundError('Webhook');
    const webhook = await prisma.tenantWebhook.update({ where: { id }, data: { isEnabled } });
    await recordAudit({
      action: isEnabled ? 'webhook.enabled' : 'webhook.disabled',
      resourceType: 'webhook',
      resourceId: id,
      tenantId,
      before: { isEnabled: existing.isEnabled },
      after: { isEnabled: webhook.isEnabled },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return toSafe(webhook);
  },

  async rotateSecret(tenantId: string, id: string, actor: TenantActorContext) {
    const existing = await prisma.tenantWebhook.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw new NotFoundError('Webhook');
    const secret = randomToken(32);
    const webhook = await prisma.tenantWebhook.update({ where: { id }, data: { secretEnc: encryptSecret(secret) } });
    await recordAudit({
      action: 'webhook.secret_rotated',
      resourceType: 'webhook',
      resourceId: id,
      tenantId,
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return { ...toSafe(webhook), secret };
  },

  async test(tenantId: string, id: string, eventKey: string | undefined, payload: Record<string, unknown> | undefined, actor: TenantActorContext) {
    const webhook = await prisma.tenantWebhook.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!webhook) throw new NotFoundError('Webhook');
    const secret = decryptSecret(webhook.secretEnc);
    const body = JSON.stringify({ event: eventKey ?? 'webhook.test', data: payload ?? {}, timestamp: new Date().toISOString() });
    const signature = hmacSha256(body, secret);

    const startedAt = Date.now();
    let ok = false;
    let responseStatus: number | null = null;
    let responseBody = '';
    let lastError: string | null = null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
    try {
      await assertSafeOutboundUrl(webhook.url, { allowHttp: env.NODE_ENV !== 'production' });
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-webhook-signature': signature, 'x-webhook-event': eventKey ?? 'webhook.test' },
        body,
        signal: controller.signal,
        redirect: 'manual',
      });
      responseStatus = response.status;
      ok = response.status < 500;
      responseBody = truncate(await response.text().catch(() => ''), 2000);
    } catch (error) {
      lastError = truncate(error instanceof Error ? error.message : String(error), 500);
    } finally {
      clearTimeout(timeout);
    }

    const durationMs = Date.now() - startedAt;
    const delivery = await prisma.tenantWebhookDelivery.create({
      data: {
        tenantId,
        webhookId: id,
        eventKey: eventKey ?? 'webhook.test',
        payload: redactObject({ event: eventKey ?? 'webhook.test', data: payload ?? {} }) as Prisma.InputJsonValue,
        status: ok ? 'SUCCESS' : 'FAILED',
        responseStatus,
        responseBody: responseBody || null,
        attempts: 1,
        lastError,
        isTest: true,
        deliveredAt: ok ? new Date() : null,
      },
    });
    await prisma.tenantWebhook.update({
      where: { id },
      data: { lastDeliveryAt: new Date(), ...(ok ? {} : { failureCount: { increment: 1 } }) },
    });
    await recordAudit({
      action: 'webhook.tested',
      resourceType: 'webhook',
      resourceId: id,
      tenantId,
      outcome: ok ? 'SUCCESS' : 'FAILURE',
      metadata: { responseStatus, durationMs },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return { ok, responseStatus, responseBody, lastError, durationMs, delivery: toDeliverySafe(delivery) };
  },

  async listDeliveries(tenantId: string, id: string, req: Request) {
    const webhook = await prisma.tenantWebhook.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!webhook) throw new NotFoundError('Webhook');
    const query = parseListQuery(req, { maxLimit: 200 });
    const where: Prisma.TenantWebhookDeliveryWhereInput = { tenantId, webhookId: id };
    if (typeof query.status === 'string' && query.status) where.status = query.status;
    const [rows, total] = await Promise.all([
      prisma.tenantWebhookDelivery.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      prisma.tenantWebhookDelivery.count({ where }),
    ]);
    return { rows: rows.map(toDeliverySafe), meta: buildPaginationMeta(query.page, query.limit, total) };
  },
};
