import type { Request } from "express";
import { Prisma, type TenantEmailProvider } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors";
import {
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import { decryptJson, encryptJson } from "../../shared/encryption";
import { maskConfig, verifyEmailProvider } from "../../shared/email";
import { truncate } from "../../shared/utils/sanitize";
import { createItsmCrudService, assertUnique } from "./crud";
import {
  validateProviderConfig,
  type CreateProviderInput,
  type TestProviderInput,
  type UpdateProviderInput,
} from "../../validators/itsm/notifications.validators";

export const notificationTemplateService = createItsmCrudService({
  resourceType: "notification_template",
  label: "Notification template",
  model: prisma.tenantNotificationTemplate,
  searchFields: ["name", "eventKey", "subject"],
  allowedSortFields: [
    "name",
    "eventKey",
    "channel",
    "status",
    "isEnabled",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["status", "channel", "eventKey", "isEnabled"],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === "string" && input.name) {
      await assertUnique(
        prisma.tenantNotificationTemplate,
        tenantId,
        "name",
        input.name,
        "notification template",
        existing?.id,
      );
    }
  },
});

export const notificationRuleService = createItsmCrudService({
  resourceType: "notification_rule",
  label: "Notification rule",
  model: prisma.tenantNotificationRule,
  statusField: null,
  searchFields: ["name", "eventKey"],
  allowedSortFields: [
    "name",
    "eventKey",
    "channel",
    "isEnabled",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["channel", "eventKey", "isEnabled", "templateId"],
  include: { template: { select: { id: true, name: true, channel: true } } },
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === "string" && input.name) {
      await assertUnique(
        prisma.tenantNotificationRule,
        tenantId,
        "name",
        input.name,
        "notification rule",
        existing?.id,
      );
    }
  },
});

export const notificationLogService = {
  async list(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 100 });
    const where: Record<string, unknown> = { tenantId };
    if (typeof query.status === "string" && query.status)
      where.status = query.status;
    const ruleId = (query as Record<string, unknown>).ruleId;
    if (typeof ruleId === "string" && ruleId) where.ruleId = ruleId;
    const channel = (query as Record<string, unknown>).channel;
    if (typeof channel === "string" && channel) where.channel = channel;
    const [rows, total] = await Promise.all([
      prisma.tenantNotificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paginationArgs(query),
      }),
      prisma.tenantNotificationLog.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async get(tenantId: string, id: string) {
    const log = await prisma.tenantNotificationLog.findFirst({
      where: { id, tenantId },
    });
    if (!log) throw new NotFoundError("Notification log");
    return log;
  },
};

const PROVIDER_STATUSES = [
  "UNVERIFIED",
  "ACTIVE",
  "DISABLED",
  "ERROR",
] as const;

function providerConfigKeys(configEnc: string): string[] {
  try {
    return Object.keys(
      maskConfig(decryptJson<Record<string, unknown>>(configEnc)),
    );
  } catch {
    return [];
  }
}

type TenantEmailProviderRow = TenantEmailProvider;

function toProviderSafe(provider: TenantEmailProviderRow) {
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

export const emailProviderService = {
  async list(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 100 });
    const where: Prisma.TenantEmailProviderWhereInput = {
      tenantId,
      deletedAt: null,
    };
    if (
      typeof query.status === "string" &&
      query.status &&
      (PROVIDER_STATUSES as readonly string[]).includes(query.status)
    ) {
      where.status = query.status;
    }
    if (typeof query.providerType === "string" && query.providerType)
      where.providerType = query.providerType;
    if (typeof query.search === "string" && query.search) {
      where.OR = [
        { key: { contains: query.search, mode: "insensitive" } },
        { name: { contains: query.search, mode: "insensitive" } },
        { fromEmail: { contains: query.search, mode: "insensitive" } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.tenantEmailProvider.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paginationArgs(query),
      }),
      prisma.tenantEmailProvider.count({ where }),
    ]);
    return {
      rows: rows.map(toProviderSafe),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  },

  async get(tenantId: string, providerId: string) {
    const provider = await prisma.tenantEmailProvider.findFirst({
      where: { id: providerId, tenantId, deletedAt: null },
    });
    if (!provider) throw new NotFoundError("Email provider");
    return toProviderSafe(provider);
  },

  async create(
    tenantId: string,
    input: CreateProviderInput,
    actorId: string | null,
    req: Request,
  ) {
    const issues = validateProviderConfig(input.providerType, input.config);
    if (issues.length > 0) {
      throw new ValidationError(
        "Provider configuration is incomplete.",
        issues.map((issue) => ({
          field: `config.${issue.key}`,
          message: issue.message,
          code: "INVALID_CONFIG",
        })),
      );
    }
    await assertUnique(
      prisma.tenantEmailProvider,
      tenantId,
      "key",
      input.key,
      "email provider",
    );

    const provider = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.tenantEmailProvider.updateMany({
          where: { tenantId, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }
      return tx.tenantEmailProvider.create({
        data: {
          tenantId,
          key: input.key,
          name: input.name,
          providerType: input.providerType,
          fromEmail: input.fromEmail,
          fromName: input.fromName ?? null,
          replyTo: input.replyTo ?? null,
          configEnc: encryptJson(input.config),
          isDefault: input.isDefault,
          createdById: actorId,
        },
      });
    });

    await recordAudit({
      action: "tenant.email.provider.created",
      resourceType: "tenant-email-provider",
      resourceId: provider.id,
      tenantId,
      after: toProviderSafe(provider),
      actorId,
      actorType: "TENANT_USER",
      req,
    });

    return toProviderSafe(provider);
  },

  async update(
    tenantId: string,
    providerId: string,
    input: Omit<UpdateProviderInput, "key">,
    actorId: string | null,
    req: Request,
  ) {
    const provider = await prisma.tenantEmailProvider.findFirst({
      where: { id: providerId, tenantId, deletedAt: null },
    });
    if (!provider) throw new NotFoundError("Email provider");

    const data: Prisma.TenantEmailProviderUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.fromEmail !== undefined) data.fromEmail = input.fromEmail;
    if (input.fromName !== undefined) data.fromName = input.fromName;
    if (input.replyTo !== undefined) data.replyTo = input.replyTo;
    if (input.isDefault !== undefined) data.isDefault = input.isDefault;

    if (input.config !== undefined) {
      const existingConfig = decryptJson<Record<string, unknown>>(
        provider.configEnc,
      );
      const merged = { ...existingConfig, ...input.config };
      const issues = validateProviderConfig(provider.providerType, merged);
      if (issues.length > 0) {
        throw new ValidationError(
          "Provider configuration is incomplete.",
          issues.map((issue) => ({
            field: `config.${issue.key}`,
            message: issue.message,
            code: "INVALID_CONFIG",
          })),
        );
      }
      data.configEnc = encryptJson(merged);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.isDefault === true) {
        await tx.tenantEmailProvider.updateMany({
          where: {
            tenantId,
            isDefault: true,
            id: { not: providerId },
            deletedAt: null,
          },
          data: { isDefault: false },
        });
      }
      return tx.tenantEmailProvider.update({ where: { id: providerId }, data });
    });

    await recordAudit({
      action: "tenant.email.provider.updated",
      resourceType: "tenant-email-provider",
      resourceId: providerId,
      tenantId,
      before: toProviderSafe(provider),
      after: toProviderSafe(updated),
      actorId,
      actorType: "TENANT_USER",
      req,
    });

    return toProviderSafe(updated);
  },

  async verify(
    tenantId: string,
    providerId: string,
    actorId: string | null,
    req: Request,
  ) {
    const provider = await prisma.tenantEmailProvider.findFirst({
      where: { id: providerId, tenantId, deletedAt: null },
    });
    if (!provider) throw new NotFoundError("Email provider");

    const result = await verifyEmailProvider(provider);
    const updated = await prisma.tenantEmailProvider.update({
      where: { id: providerId },
      data: {
        status: result.ok ? "ACTIVE" : "ERROR",
        lastTestedAt: new Date(),
        lastTestResult: truncate(result.message, 500),
      },
    });

    await recordAudit({
      action: "tenant.email.provider.verified",
      resourceType: "tenant-email-provider",
      resourceId: providerId,
      tenantId,
      outcome: result.ok ? "SUCCESS" : "FAILURE",
      metadata: { message: truncate(result.message, 300) },
      actorId,
      actorType: "TENANT_USER",
      req,
    });

    return { ok: result.ok, message: result.message, status: updated.status };
  },

  async test(
    tenantId: string,
    providerId: string,
    input: TestProviderInput,
    actorId: string | null,
    req: Request,
  ) {
    const provider = await prisma.tenantEmailProvider.findFirst({
      where: { id: providerId, tenantId, deletedAt: null },
    });
    if (!provider) throw new NotFoundError("Email provider");

    const verified = await verifyEmailProvider(provider);
    await prisma.tenantEmailProvider.update({
      where: { id: providerId },
      data: {
        status: verified.ok ? "ACTIVE" : "ERROR",
        lastTestedAt: new Date(),
        lastTestResult: truncate(
          `${verified.ok ? "OK" : "FAILED"}: ${input.to} — ${verified.message}`,
          500,
        ),
      },
    });

    await recordAudit({
      action: "tenant.email.provider.tested",
      resourceType: "tenant-email-provider",
      resourceId: providerId,
      tenantId,
      outcome: verified.ok ? "SUCCESS" : "FAILURE",
      metadata: { to: input.to, message: truncate(verified.message, 300) },
      actorId,
      actorType: "TENANT_USER",
      req,
    });

    return {
      sent: verified.ok,
      deliveryId: null,
      error: verified.ok ? null : verified.message,
      providerStatus: verified.ok ? "ACTIVE" : "ERROR",
    };
  },

  async disable(
    tenantId: string,
    providerId: string,
    actorId: string | null,
    req: Request,
  ) {
    const provider = await prisma.tenantEmailProvider.findFirst({
      where: { id: providerId, tenantId, deletedAt: null },
    });
    if (!provider) throw new NotFoundError("Email provider");

    const updated = await prisma.tenantEmailProvider.update({
      where: { id: providerId },
      data: { status: "DISABLED", isDefault: false },
    });

    await recordAudit({
      action: "tenant.email.provider.disabled",
      resourceType: "tenant-email-provider",
      resourceId: providerId,
      tenantId,
      before: { status: provider.status },
      after: { status: updated.status },
      actorId,
      actorType: "TENANT_USER",
      req,
    });

    return toProviderSafe(updated);
  },
};
