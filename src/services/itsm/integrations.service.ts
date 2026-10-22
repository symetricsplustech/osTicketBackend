import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import {
  ConflictError,
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
import { decryptJson, encryptJson } from "../../shared/encryption";
import { assertSafeOutboundUrl } from "../../shared/webhooks/ssrf";
import { redactObject, truncate } from "../../shared/utils/sanitize";
import type { TenantActorContext } from "../tenantadmin/roles.service";

const TEST_TIMEOUT_MS = 10_000;
const CREDENTIAL_KEY_PATTERN =
  /(api[-_]?key|token|secret|password|client[-_]?id|client[-_]?secret|username|user|url|base[-_]?url|host|endpoint|domain)/i;

function maskConfig(configEnc: string | null): {
  configured: boolean;
  configKeys: string[];
} {
  if (!configEnc) return { configured: false, configKeys: [] };
  try {
    return {
      configured: true,
      configKeys: Object.keys(decryptJson<Record<string, unknown>>(configEnc)),
    };
  } catch {
    return { configured: false, configKeys: [] };
  }
}

function toSafe(integration: {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string | null;
  configEnc: string | null;
  status: string;
  isEnabled: boolean;
  lastTestedAt: Date | null;
  lastTestResult: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const masked = maskConfig(integration.configEnc);
  return {
    id: integration.id,
    name: integration.name,
    provider: integration.provider,
    category: integration.category,
    description: integration.description,
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

export const integrationService = {
  async list(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 100 });
    const where: Prisma.TenantIntegrationWhereInput = {
      tenantId,
      deletedAt: null,
    };
    if (typeof query.status === "string" && query.status)
      where.status = query.status;
    const category = (query as Record<string, unknown>).category;
    if (typeof category === "string" && category) where.category = category;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { provider: { contains: query.search, mode: "insensitive" } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.tenantIntegration.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paginationArgs(query),
      }),
      prisma.tenantIntegration.count({ where }),
    ]);
    return {
      rows: rows.map(toSafe),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  },

  async get(tenantId: string, id: string) {
    const integration = await prisma.tenantIntegration.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { logs: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
    if (!integration) throw new NotFoundError("Integration");
    return {
      ...toSafe(integration),
      recentLogs: integration.logs.map((log) => ({
        id: log.id,
        level: log.level,
        action: log.action,
        message: log.message,
        context: redactObject(log.context),
        createdAt: log.createdAt,
      })),
    };
  },

  async create(
    tenantId: string,
    input: Record<string, unknown>,
    actor: TenantActorContext,
  ) {
    const existing = await prisma.tenantIntegration.findFirst({
      where: { tenantId, name: String(input.name), deletedAt: null },
      select: { id: true },
    });
    if (existing)
      throw new ConflictError(
        "An integration with this name already exists in the organization.",
      );
    const config = input.config as Record<string, unknown> | undefined;
    if (config !== undefined && Object.keys(config).length === 0) {
      throw new ValidationError("Configuration must contain at least one key.");
    }
    const enabled = input.isEnabled === true;
    const integration = await prisma.tenantIntegration.create({
      data: {
        tenantId,
        name: String(input.name),
        provider: String(input.provider),
        category: (input.category as string) ?? "GENERAL",
        description: (input.description as string) ?? null,
        configEnc: config !== undefined ? encryptJson(config) : null,
        isEnabled: enabled,
        status: enabled ? "ENABLED" : "UNCONFIGURED",
        createdById: actor.actorId ?? null,
      },
    });
    await recordAudit({
      action: "integration.created",
      resourceType: "integration",
      resourceId: integration.id,
      tenantId,
      after: toSafe(integration),
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return toSafe(integration);
  },

  async update(
    tenantId: string,
    id: string,
    input: Record<string, unknown>,
    actor: TenantActorContext,
  ) {
    const integration = await prisma.tenantIntegration.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!integration) throw new NotFoundError("Integration");
    if (typeof input.name === "string" && input.name !== integration.name) {
      const dup = await prisma.tenantIntegration.findFirst({
        where: { tenantId, name: input.name, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (dup)
        throw new ConflictError(
          "An integration with this name already exists in the organization.",
        );
    }
    const config = input.config as Record<string, unknown> | undefined;
    if (config !== undefined && Object.keys(config).length === 0) {
      throw new ValidationError("Configuration must contain at least one key.");
    }
    const data: Prisma.TenantIntegrationUpdateInput = {};
    if (input.name !== undefined) data.name = String(input.name);
    if (input.category !== undefined) data.category = String(input.category);
    if (input.description !== undefined)
      data.description = input.description as string;
    if (config !== undefined) data.configEnc = encryptJson(config);
    if (input.isEnabled === true) {
      data.isEnabled = true;
      data.status = "ENABLED";
    } else if (input.isEnabled === false) {
      data.isEnabled = false;
      data.status = "DISABLED";
    } else if (config !== undefined && integration.status === "UNCONFIGURED") {
      data.status = "DISABLED";
    }
    const updated = await prisma.tenantIntegration.update({
      where: { id },
      data,
    });
    await recordAudit({
      action: "integration.updated",
      resourceType: "integration",
      resourceId: id,
      tenantId,
      before: toSafe(integration),
      after: toSafe(updated),
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return toSafe(updated);
  },

  async remove(tenantId: string, id: string, actor: TenantActorContext) {
    const integration = await prisma.tenantIntegration.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!integration) throw new NotFoundError("Integration");
    await prisma.tenantIntegration.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await recordAudit({
      action: "integration.deleted",
      resourceType: "integration",
      resourceId: id,
      tenantId,
      before: toSafe(integration),
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
  },

  async setEnabled(
    tenantId: string,
    id: string,
    isEnabled: boolean,
    actor: TenantActorContext,
  ) {
    const integration = await prisma.tenantIntegration.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!integration) throw new NotFoundError("Integration");
    const updated = await prisma.tenantIntegration.update({
      where: { id },
      data: { isEnabled, status: isEnabled ? "ENABLED" : "DISABLED" },
    });
    await recordAudit({
      action: isEnabled ? "integration.enabled" : "integration.disabled",
      resourceType: "integration",
      resourceId: id,
      tenantId,
      before: { isEnabled: integration.isEnabled, status: integration.status },
      after: { isEnabled: updated.isEnabled, status: updated.status },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return toSafe(updated);
  },

  async test(tenantId: string, id: string, actor: TenantActorContext) {
    const integration = await prisma.tenantIntegration.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!integration) throw new NotFoundError("Integration");
    if (!integration.configEnc)
      throw new PreconditionFailedError(
        "This integration has no configuration to test.",
      );

    const config = decryptJson<Record<string, unknown>>(integration.configEnc);
    const startedAt = Date.now();
    let ok = false;
    let message = "";
    let statusCode: number | null = null;
    let context: Record<string, unknown> = {};

    const rawUrl =
      (typeof config["baseUrl"] === "string" && config["baseUrl"].trim()) ||
      (typeof config["url"] === "string" && config["url"].trim()) ||
      null;
    if (rawUrl) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
      try {
        await assertSafeOutboundUrl(rawUrl, {
          allowHttp: env.NODE_ENV !== "production",
        });
        const response = await fetch(rawUrl, {
          method: "GET",
          signal: controller.signal,
          redirect: "manual",
        });
        statusCode = response.status;
        ok = response.status < 500;
        message = `Destination responded with HTTP ${response.status}.`;
        context = { url: rawUrl, statusCode: response.status };
      } catch (error) {
        const detail = truncate(
          error instanceof Error ? error.message : String(error),
          300,
        );
        message = `Connectivity check failed: ${detail}`;
        context = { url: rawUrl, error: detail };
      } finally {
        clearTimeout(timeout);
      }
    } else {
      const providedKeys = Object.entries(config)
        .filter(
          ([key, value]) =>
            CREDENTIAL_KEY_PATTERN.test(key) &&
            value !== null &&
            value !== undefined &&
            String(value).trim() !== "",
        )
        .map(([key]) => key);
      if (providedKeys.length > 0) {
        ok = true;
        message =
          "Credentials present; provider-specific connectivity cannot be probed without a URL.";
      } else {
        message =
          "No URL or recognizable credentials were found in the configuration.";
      }
      context = { providedKeys };
    }

    const durationMs = Date.now() - startedAt;
    const resultMessage = truncate(message, 500);
    await prisma.tenantIntegrationLog.create({
      data: {
        tenantId,
        integrationId: id,
        level: ok ? "info" : "error",
        action: "test",
        message: resultMessage,
        context: redactObject({
          ...context,
          durationMs,
        }) as Prisma.InputJsonValue,
      },
    });
    const updated = await prisma.tenantIntegration.update({
      where: { id },
      data: {
        lastTestedAt: new Date(),
        lastTestResult: resultMessage,
        status: ok ? "ENABLED" : "ERROR",
      },
    });
    await recordAudit({
      action: "integration.tested",
      resourceType: "integration",
      resourceId: id,
      tenantId,
      outcome: ok ? "SUCCESS" : "FAILURE",
      metadata: { statusCode, durationMs, message: resultMessage },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return {
      ok,
      message: resultMessage,
      statusCode,
      durationMs,
      status: updated.status,
    };
  },

  async listLogs(tenantId: string, id: string, req: Request) {
    const integration = await prisma.tenantIntegration.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!integration) throw new NotFoundError("Integration");
    const query = parseListQuery(req, { maxLimit: 200 });
    const where: Prisma.TenantIntegrationLogWhereInput = {
      tenantId,
      integrationId: id,
    };
    const level = (query as Record<string, unknown>).level;
    if (typeof level === "string" && level) where.level = level;
    const [rows, total] = await Promise.all([
      prisma.tenantIntegrationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paginationArgs(query),
      }),
      prisma.tenantIntegrationLog.count({ where }),
    ]);
    return {
      rows: rows.map((log) => ({
        id: log.id,
        level: log.level,
        action: log.action,
        message: log.message,
        context: redactObject(log.context),
        createdAt: log.createdAt,
      })),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  },
};
