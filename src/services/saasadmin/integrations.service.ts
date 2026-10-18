import type { Request } from 'express';
import { Prisma, type Integration, type IntegrationLog } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { ConflictError, NotFoundError, PreconditionFailedError, ValidationError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import { decryptJson, encryptJson } from '../../shared/encryption';
import { assertSafeOutboundUrl } from '../../shared/webhooks/ssrf';
import { redactObject, truncate } from '../../shared/utils/sanitize';
import type {
  CreateIntegrationInput,
  UpdateIntegrationInput,
} from '../../validators/saasadmin/integrations.validators';

export interface IntegrationActor {
  actorId?: string | null;
  req?: Request;
}

const INTEGRATION_STATUSES = ['UNCONFIGURED', 'ENABLED', 'DISABLED', 'ERROR'] as const;

const INTEGRATION_TEST_TIMEOUT_MS = 10_000;

const CREDENTIAL_KEY_PATTERN = /(api[-_]?key|token|secret|password|client[-_]?id|client[-_]?secret|username|user|url|base[-_]?url|host|endpoint|domain)/i;

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

/**
 * Mask-like helper for integration configuration: the platform never returns decrypted
 * configuration values, so only the presence and key names are exposed.
 */
function maskIntegrationConfig(configEnc: string | null): { configured: boolean; configKeys: string[] } {
  if (!configEnc) return { configured: false, configKeys: [] };
  try {
    const config = decryptJson<Record<string, unknown>>(configEnc);
    return { configured: true, configKeys: Object.keys(config) };
  } catch {
    return { configured: false, configKeys: [] };
  }
}

function toIntegrationSafe(integration: Integration) {
  const masked = maskIntegrationConfig(integration.configEnc);
  return {
    id: integration.id,
    key: integration.key,
    name: integration.name,
    provider: integration.provider,
    description: integration.description,
    category: integration.category,
    status: integration.status,
    isEnabled: integration.isEnabled,
    lastTestedAt: integration.lastTestedAt,
    lastTestResult: integration.lastTestResult,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
    configured: masked.configured,
    configKeys: masked.configKeys,
  };
}

function toIntegrationLogSafe(log: IntegrationLog) {
  return {
    id: log.id,
    integrationId: log.integrationId,
    level: log.level,
    action: log.action,
    message: log.message,
    context: redactObject(log.context),
    createdAt: log.createdAt,
  };
}

export async function listIntegrations(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const status = pickEnum(query.status, INTEGRATION_STATUSES);
  const isEnabled = queryBoolean(query.isEnabled);

  const where: Prisma.IntegrationWhereInput = {
    ...(status ? { status } : {}),
    ...(isEnabled !== undefined ? { isEnabled } : {}),
    ...(query.category ? { category: String(query.category) } : {}),
    ...(query.search
      ? {
          OR: [
            { key: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
            { provider: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.integration.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
    prisma.integration.count({ where }),
  ]);

  return { rows: rows.map(toIntegrationSafe), meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function createIntegration(input: CreateIntegrationInput, actor: IntegrationActor) {
  const existing = await prisma.integration.findUnique({ where: { key: input.key } });
  if (existing) throw new ConflictError(`An integration with the key "${input.key}" already exists.`);

  if (input.config !== undefined && Object.keys(input.config).length === 0) {
    throw new ValidationError('Configuration must contain at least one key.', [
      { field: 'config', message: 'Configuration must contain at least one key.', code: 'EMPTY_CONFIG' },
    ]);
  }

  const enabled = input.isEnabled === true;
  const integration = await prisma.integration.create({
    data: {
      key: input.key,
      name: input.name,
      provider: input.provider,
      description: input.description ?? null,
      category: input.category ?? 'GENERAL',
      configEnc: input.config !== undefined ? encryptJson(input.config) : null,
      isEnabled: enabled,
      status: enabled ? 'ENABLED' : 'UNCONFIGURED',
      createdById: actor.actorId ?? null,
    },
  });

  await recordAudit({
    action: 'integration.created',
    resourceType: 'integration',
    resourceId: integration.id,
    after: toIntegrationSafe(integration),
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return toIntegrationSafe(integration);
}

export async function getIntegration(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    include: { logs: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });
  if (!integration) throw new NotFoundError('Integration');

  return {
    ...toIntegrationSafe(integration),
    recentLogs: integration.logs.map(toIntegrationLogSafe),
  };
}

export async function updateIntegration(integrationId: string, input: UpdateIntegrationInput, actor: IntegrationActor) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw new NotFoundError('Integration');

  if (input.config !== undefined && Object.keys(input.config).length === 0) {
    throw new ValidationError('Configuration must contain at least one key.', [
      { field: 'config', message: 'Configuration must contain at least one key.', code: 'EMPTY_CONFIG' },
    ]);
  }

  const data: Prisma.IntegrationUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.category !== undefined) data.category = input.category;
  if (input.config !== undefined) data.configEnc = encryptJson(input.config);

  if (input.isEnabled === true) {
    data.isEnabled = true;
    data.status = 'ENABLED';
  } else if (input.isEnabled === false) {
    data.isEnabled = false;
    data.status = 'DISABLED';
  } else if (input.config !== undefined && integration.status === 'UNCONFIGURED') {
    data.status = 'DISABLED';
  }

  const updated = await prisma.integration.update({ where: { id: integrationId }, data });

  await recordAudit({
    action: 'integration.updated',
    resourceType: 'integration',
    resourceId: integrationId,
    before: toIntegrationSafe(integration),
    after: toIntegrationSafe(updated),
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return toIntegrationSafe(updated);
}

export async function testIntegration(integrationId: string, actor: IntegrationActor) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw new NotFoundError('Integration');
  if (!integration.configEnc) {
    throw new PreconditionFailedError('This integration has no configuration to test.');
  }

  const config = decryptJson<Record<string, unknown>>(integration.configEnc);
  const startedAt = Date.now();

  let ok = false;
  let message = '';
  let statusCode: number | null = null;
  let context: Record<string, unknown> = {};

  const baseUrl = typeof config['baseUrl'] === 'string' ? config['baseUrl'].trim() : '';
  const directUrl = typeof config['url'] === 'string' ? config['url'].trim() : '';
  const rawUrl = baseUrl || directUrl || null;

  if (rawUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), INTEGRATION_TEST_TIMEOUT_MS);
    try {
      await assertSafeOutboundUrl(rawUrl, { allowHttp: env.NODE_ENV !== 'production' });
      const response = await fetch(rawUrl, { method: 'GET', signal: controller.signal, redirect: 'manual' });
      statusCode = response.status;
      ok = response.status < 500;
      message = `Destination responded with HTTP ${response.status}.`;
      context = { url: rawUrl, statusCode: response.status };
    } catch (error) {
      const detail = truncate(error instanceof Error ? error.message : String(error), 300);
      message = `Connectivity check failed: ${detail}`;
      context = { url: rawUrl, error: detail };
    } finally {
      clearTimeout(timeout);
    }
  } else {
    const providedKeys = Object.entries(config)
      .filter(
        ([key, value]) =>
          CREDENTIAL_KEY_PATTERN.test(key) && value !== null && value !== undefined && String(value).trim() !== '',
      )
      .map(([key]) => key);

    if (providedKeys.length > 0) {
      ok = true;
      message = 'Credentials present; provider-specific connectivity cannot be probed without a URL.';
    } else {
      message = 'No URL or recognizable credentials were found in the configuration.';
    }
    context = { providedKeys };
  }

  const durationMs = Date.now() - startedAt;
  const resultMessage = truncate(message, 500);

  await prisma.integrationLog.create({
    data: {
      integrationId,
      level: ok ? 'info' : 'error',
      action: 'test',
      message: resultMessage,
      context: redactObject({ ...context, durationMs }) as Prisma.InputJsonValue,
    },
  });

  const updated = await prisma.integration.update({
    where: { id: integrationId },
    data: {
      lastTestedAt: new Date(),
      lastTestResult: resultMessage,
      status: ok ? 'ENABLED' : 'ERROR',
    },
  });

  await recordAudit({
    action: 'integration.tested',
    resourceType: 'integration',
    resourceId: integrationId,
    outcome: ok ? 'SUCCESS' : 'FAILURE',
    metadata: { statusCode, durationMs, message: resultMessage },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return { ok, message: resultMessage, statusCode, durationMs, status: updated.status };
}

export async function setIntegrationEnabled(integrationId: string, isEnabled: boolean, actor: IntegrationActor) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw new NotFoundError('Integration');

  const updated = await prisma.integration.update({
    where: { id: integrationId },
    data: { isEnabled, status: isEnabled ? 'ENABLED' : 'DISABLED' },
  });

  await recordAudit({
    action: isEnabled ? 'integration.enabled' : 'integration.disabled',
    resourceType: 'integration',
    resourceId: integrationId,
    before: { isEnabled: integration.isEnabled, status: integration.status },
    after: { isEnabled: updated.isEnabled, status: updated.status },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  void publishEvent({
    eventKey: isEnabled ? 'integration.enabled' : 'integration.disabled',
    payload: { integrationId: updated.id, key: updated.key },
  });

  return toIntegrationSafe(updated);
}

export async function listIntegrationLogs(integrationId: string, req: Request) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: { id: true },
  });
  if (!integration) throw new NotFoundError('Integration');

  const query = parseListQuery(req, { maxLimit: 200 });
  const where: Prisma.IntegrationLogWhereInput = {
    integrationId,
    ...(query.level ? { level: String(query.level) } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.integrationLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
    prisma.integrationLog.count({ where }),
  ]);

  return { rows: rows.map(toIntegrationLogSafe), meta: buildPaginationMeta(query.page, query.limit, total) };
}

export { toIntegrationSafe, toIntegrationLogSafe };
