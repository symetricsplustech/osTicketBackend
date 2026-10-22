import type { Request } from "express";
import { Prisma, type ApiKey } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from "../../shared/errors";
import {
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import { publishEvent } from "../../shared/events";
import { isKnownPermission } from "../../shared/permissions/catalog";
import { generateApiKey } from "../../shared/utils/crypto";
import type {
  CreateApiKeyInput,
  RevokeApiKeyInput,
  UpdateApiKeyInput,
} from "../../validators/saasadmin/api-keys.validators";

const KEY_ROTATION_EXPIRY_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

function queryBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalised = String(value).toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalised)) return true;
  if (["false", "0", "no", "off"].includes(normalised)) return false;
  return undefined;
}

function toApiKeySafe(apiKey: ApiKey) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    scopes: Array.isArray(apiKey.scopes) ? apiKey.scopes.map(String) : [],
    tenantId: apiKey.tenantId,
    rotatedFromId: apiKey.rotatedFromId,
    expiresAt: apiKey.expiresAt,
    lastUsedAt: apiKey.lastUsedAt,
    revokedAt: apiKey.revokedAt,
    revokedReason: apiKey.revokedReason,
    createdAt: apiKey.createdAt,
    updatedAt: apiKey.updatedAt,
  };
}

function assertValidScopes(scopes: string[], req: Request): void {
  const permissions = req.auth?.permissions ?? [];
  const hasWildcardPermission = permissions.includes("*");
  const hasManagePermission =
    permissions.includes("admin.api-keys.manage") || hasWildcardPermission;

  const invalid: string[] = [];
  for (const scope of scopes) {
    if (scope === "*") {
      if (!hasManagePermission || !hasWildcardPermission) {
        throw new ForbiddenError(
          "Only a platform owner with wildcard permissions may create wildcard API keys.",
        );
      }
      continue;
    }
    if (!isKnownPermission(scope)) invalid.push(scope);
  }

  if (invalid.length > 0) {
    throw new ValidationError(
      "One or more scopes are not recognised by the platform.",
      invalid.map((scope) => ({
        field: "scopes",
        message: `Unknown permission code: ${scope}`,
        code: "UNKNOWN_SCOPE",
      })),
    );
  }
}

export async function listApiKeys(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const includeRevoked = queryBoolean(query.includeRevoked) ?? false;

  const where: Prisma.ApiKeyWhereInput = {
    ...(includeRevoked ? {} : { revokedAt: null }),
    ...(query.tenantId ? { tenantId: String(query.tenantId) } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { keyPrefix: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.apiKey.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginationArgs(query),
    }),
    prisma.apiKey.count({ where }),
  ]);

  return {
    rows: rows.map(toApiKeySafe),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function createApiKey(input: CreateApiKeyInput, req: Request) {
  assertValidScopes(input.scopes, req);

  if (input.tenantId) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: input.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundError("Tenant");
  }

  const generated = generateApiKey();
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * DAY_MS)
    : null;

  const apiKey = await prisma.apiKey.create({
    data: {
      name: input.name,
      keyPrefix: generated.prefix,
      keyHash: generated.hash,
      scopes: input.scopes as unknown as Prisma.InputJsonValue,
      tenantId: input.tenantId ?? null,
      createdById: req.auth?.userId ?? null,
      expiresAt,
    },
  });

  await recordAudit({
    action: "api-key.created",
    resourceType: "api-key",
    resourceId: apiKey.id,
    tenantId: apiKey.tenantId,
    after: toApiKeySafe(apiKey),
    actorId: req.auth?.userId ?? null,
    req,
  });

  void publishEvent({
    eventKey: "apikey.created",
    tenantId: apiKey.tenantId,
    payload: {
      apiKeyId: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
    },
  });

  return { apiKey: toApiKeySafe(apiKey), secret: generated.secret };
}

export async function getApiKey(keyId: string) {
  const apiKey = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!apiKey) throw new NotFoundError("API key");
  return toApiKeySafe(apiKey);
}

export async function updateApiKey(
  keyId: string,
  input: UpdateApiKeyInput,
  req: Request,
) {
  const apiKey = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!apiKey) throw new NotFoundError("API key");
  if (apiKey.revokedAt)
    throw new PreconditionFailedError("Revoked API keys cannot be updated.");

  if (input.scopes !== undefined) assertValidScopes(input.scopes, req);

  const data: Prisma.ApiKeyUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.scopes !== undefined)
    data.scopes = input.scopes as unknown as Prisma.InputJsonValue;
  if (input.expiresAt !== undefined) {
    if (input.expiresAt.getTime() <= Date.now()) {
      throw new ValidationError("Expiry must be in the future.", [
        {
          field: "expiresAt",
          message: "Expiry must be in the future.",
          code: "INVALID_EXPIRY",
        },
      ]);
    }
    data.expiresAt = input.expiresAt;
  }

  const updated = await prisma.apiKey.update({ where: { id: keyId }, data });

  await recordAudit({
    action: "api-key.updated",
    resourceType: "api-key",
    resourceId: keyId,
    tenantId: updated.tenantId,
    before: toApiKeySafe(apiKey),
    after: toApiKeySafe(updated),
    actorId: req.auth?.userId ?? null,
    req,
  });

  return toApiKeySafe(updated);
}

export async function rotateApiKey(keyId: string, req: Request) {
  const apiKey = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!apiKey) throw new NotFoundError("API key");
  if (apiKey.revokedAt)
    throw new PreconditionFailedError("Revoked API keys cannot be rotated.");

  const generated = generateApiKey();
  const rotationExpiry = Date.now() + KEY_ROTATION_EXPIRY_DAYS * DAY_MS;
  const expiresAt =
    apiKey.expiresAt && apiKey.expiresAt.getTime() < rotationExpiry
      ? apiKey.expiresAt
      : new Date(rotationExpiry);

  const replacement = await prisma.$transaction(async (tx) => {
    await tx.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date(), revokedReason: "ROTATED" },
    });
    return tx.apiKey.create({
      data: {
        name: apiKey.name,
        keyPrefix: generated.prefix,
        keyHash: generated.hash,
        scopes: apiKey.scopes as unknown as Prisma.InputJsonValue,
        tenantId: apiKey.tenantId,
        createdById: req.auth?.userId ?? null,
        rotatedFromId: apiKey.id,
        expiresAt,
      },
    });
  });

  await recordAudit({
    action: "api-key.rotated",
    resourceType: "api-key",
    resourceId: apiKey.id,
    tenantId: apiKey.tenantId,
    before: { keyPrefix: apiKey.keyPrefix, revokedAt: null },
    after: {
      keyPrefix: replacement.keyPrefix,
      revokedAt: replacement.revokedAt,
      rotatedToId: replacement.id,
    },
    actorId: req.auth?.userId ?? null,
    req,
  });

  void publishEvent({
    eventKey: "apikey.created",
    tenantId: replacement.tenantId,
    payload: {
      apiKeyId: replacement.id,
      rotatedFromId: apiKey.id,
      name: replacement.name,
    },
  });

  return { apiKey: toApiKeySafe(replacement), secret: generated.secret };
}

export async function revokeApiKey(
  keyId: string,
  input: RevokeApiKeyInput,
  req: Request,
) {
  const apiKey = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!apiKey) throw new NotFoundError("API key");
  if (apiKey.revokedAt)
    throw new PreconditionFailedError("This API key has already been revoked.");

  const updated = await prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date(), revokedReason: input.reason ?? "REVOKED" },
  });

  await recordAudit({
    action: "api-key.revoked",
    resourceType: "api-key",
    resourceId: keyId,
    tenantId: updated.tenantId,
    before: { revokedAt: null },
    after: {
      revokedAt: updated.revokedAt,
      revokedReason: updated.revokedReason,
    },
    actorId: req.auth?.userId ?? null,
    req,
  });

  void publishEvent({
    eventKey: "apikey.revoked",
    tenantId: updated.tenantId,
    payload: { apiKeyId: updated.id, reason: updated.revokedReason },
  });

  return toApiKeySafe(updated);
}

export async function getApiKeyUsage(keyId: string, req: Request) {
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
    select: { id: true },
  });
  if (!apiKey) throw new NotFoundError("API key");

  const query = parseListQuery(req, { maxLimit: 100 });
  const statusCodeRaw = query.statusCode;
  const statusCode =
    statusCodeRaw !== undefined &&
    statusCodeRaw !== null &&
    String(statusCodeRaw).trim() !== "" &&
    !Number.isNaN(Number(statusCodeRaw))
      ? Number(statusCodeRaw)
      : undefined;

  const where: Prisma.ApiKeyUsageWhereInput = {
    apiKeyId: keyId,
    ...(query.method ? { method: String(query.method).toUpperCase() } : {}),
    ...(statusCode !== undefined ? { statusCode } : {}),
  };

  const last24hSince = new Date(Date.now() - DAY_MS);

  const [rows, filteredTotal, totalRequests, last24h, errorCount] =
    await Promise.all([
      prisma.apiKeyUsage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paginationArgs(query),
      }),
      prisma.apiKeyUsage.count({ where }),
      prisma.apiKeyUsage.count({ where: { apiKeyId: keyId } }),
      prisma.apiKeyUsage.count({
        where: { apiKeyId: keyId, createdAt: { gte: last24hSince } },
      }),
      prisma.apiKeyUsage.count({
        where: { apiKeyId: keyId, statusCode: { gte: 400 } },
      }),
    ]);

  const errorRate =
    totalRequests > 0 ? Number((errorCount / totalRequests).toFixed(4)) : 0;

  return {
    rows,
    meta: buildPaginationMeta(query.page, query.limit, filteredTotal),
    aggregate: { totalRequests, last24h, errorRate },
  };
}

export { toApiKeySafe };
