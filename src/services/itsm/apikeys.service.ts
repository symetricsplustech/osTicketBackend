import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, PreconditionFailedError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { generateApiKey } from '../../shared/utils/crypto';
import type { TenantActorContext } from '../tenantadmin/roles.service';

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: unknown;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  rotatedFromId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toSafe(key: ApiKeyRow) {
  const expired = key.expiresAt ? key.expiresAt.getTime() < Date.now() : false;
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes,
    expiresAt: key.expiresAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    revokedReason: key.revokedReason,
    rotatedFromId: key.rotatedFromId,
    createdAt: key.createdAt,
    updatedAt: key.updatedAt,
    status: key.revokedAt ? 'REVOKED' : expired ? 'EXPIRED' : 'ACTIVE',
    expired,
  };
}

export const apiKeyService = {
  async list(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 100 });
    const where: Prisma.TenantApiKeyWhereInput = { tenantId };
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    const [rows, total] = await Promise.all([
      prisma.tenantApiKey.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      prisma.tenantApiKey.count({ where }),
    ]);
    return { rows: rows.map(toSafe), meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async get(tenantId: string, id: string) {
    const key = await prisma.tenantApiKey.findFirst({ where: { id, tenantId } });
    if (!key) throw new NotFoundError('API key');
    return toSafe(key);
  },

  async create(tenantId: string, input: Record<string, unknown>, actor: TenantActorContext) {
    const { secret, prefix, hash } = generateApiKey();
    const key = await prisma.tenantApiKey.create({
      data: {
        tenantId,
        name: String(input.name),
        keyPrefix: prefix,
        keyHash: hash,
        scopes: (input.scopes as Prisma.InputJsonValue) ?? [],
        expiresAt: (input.expiresAt as Date | null | undefined) ?? null,
        createdById: actor.actorId ?? null,
      },
    });
    await recordAudit({
      action: 'api_key.created',
      resourceType: 'api_key',
      resourceId: key.id,
      tenantId,
      after: toSafe(key),
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return { ...toSafe(key), secret };
  },

  async update(tenantId: string, id: string, input: Record<string, unknown>, actor: TenantActorContext) {
    const existing = await prisma.tenantApiKey.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundError('API key');
    if (existing.revokedAt) throw new PreconditionFailedError('This API key has been revoked and cannot be modified.');
    const data: Prisma.TenantApiKeyUpdateInput = {};
    if (input.name !== undefined) data.name = String(input.name);
    if (input.scopes !== undefined) data.scopes = input.scopes as Prisma.InputJsonValue;
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt as Date | null;
    const key = await prisma.tenantApiKey.update({ where: { id }, data });
    await recordAudit({
      action: 'api_key.updated',
      resourceType: 'api_key',
      resourceId: id,
      tenantId,
      before: toSafe(existing),
      after: toSafe(key),
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return toSafe(key);
  },

  async revoke(tenantId: string, id: string, reason: string | undefined, actor: TenantActorContext) {
    const existing = await prisma.tenantApiKey.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundError('API key');
    const key = await prisma.tenantApiKey.update({
      where: { id },
      data: { revokedAt: new Date(), revokedReason: reason ?? null },
    });
    await recordAudit({
      action: 'api_key.revoked',
      resourceType: 'api_key',
      resourceId: id,
      tenantId,
      before: { revokedAt: existing.revokedAt },
      after: { revokedAt: key.revokedAt, revokedReason: key.revokedReason },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return toSafe(key);
  },

  async rotate(tenantId: string, id: string, actor: TenantActorContext) {
    const existing = await prisma.tenantApiKey.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundError('API key');
    if (existing.revokedAt) throw new PreconditionFailedError('This API key has been revoked and cannot be rotated.');
    const { secret, prefix, hash } = generateApiKey();
    const [, created] = await prisma.$transaction([
      prisma.tenantApiKey.update({ where: { id }, data: { revokedAt: new Date(), revokedReason: 'rotated' } }),
      prisma.tenantApiKey.create({
        data: {
          tenantId,
          name: existing.name,
          keyPrefix: prefix,
          keyHash: hash,
          scopes: existing.scopes as Prisma.InputJsonValue,
          expiresAt: existing.expiresAt,
          rotatedFromId: existing.id,
          createdById: actor.actorId ?? null,
        },
      }),
    ]);
    await recordAudit({
      action: 'api_key.rotated',
      resourceType: 'api_key',
      resourceId: created.id,
      tenantId,
      metadata: { rotatedFromId: existing.id },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return { ...toSafe(created), secret };
  },

  async listUsage(tenantId: string, id: string, req: Request) {
    const key = await prisma.tenantApiKey.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!key) throw new NotFoundError('API key');
    const query = parseListQuery(req, { maxLimit: 200 });
    const where = { tenantId, apiKeyId: id };
    const [rows, total] = await Promise.all([
      prisma.tenantApiKeyUsage.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      prisma.tenantApiKeyUsage.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },
};
