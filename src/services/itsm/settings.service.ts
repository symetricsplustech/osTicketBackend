import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { NotFoundError } from "../../shared/errors";
import {
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import type { TenantActorContext } from "../tenantadmin/roles.service";

export const settingService = {
  async list(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 200 });
    const prefix =
      typeof (query as Record<string, unknown>).prefix === "string"
        ? String((query as Record<string, unknown>).prefix)
        : undefined;
    const where: Prisma.TenantSettingWhereInput = {
      tenantId,
      ...(query.search
        ? { key: { contains: query.search, mode: "insensitive" } }
        : {}),
      ...(prefix ? { key: { startsWith: prefix } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.tenantSetting.findMany({
        where,
        orderBy: { key: "asc" },
        ...paginationArgs(query),
      }),
      prisma.tenantSetting.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async get(tenantId: string, key: string) {
    const setting = await prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (!setting) throw new NotFoundError("Setting");
    return setting;
  },

  async upsert(
    tenantId: string,
    key: string,
    value: unknown,
    actor: TenantActorContext,
  ) {
    const setting = await prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: {
        tenantId,
        key,
        value: value as Prisma.InputJsonValue,
        updatedById: actor.actorId ?? null,
      },
      update: {
        value: value as Prisma.InputJsonValue,
        updatedById: actor.actorId ?? null,
      },
    });
    await recordAudit({
      action: "settings.updated",
      resourceType: "setting",
      resourceId: setting.id,
      tenantId,
      after: { key, value },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return setting;
  },

  async remove(tenantId: string, key: string, actor: TenantActorContext) {
    const setting = await prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (!setting) throw new NotFoundError("Setting");
    await prisma.tenantSetting.delete({
      where: { tenantId_key: { tenantId, key } },
    });
    await recordAudit({
      action: "settings.deleted",
      resourceType: "setting",
      resourceId: setting.id,
      tenantId,
      before: { key },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
  },
};

export const PORTAL_CONFIG_KEY = "portal.config";
export const PORTAL_FORM_PREFIX = "portal.form.";

export const portalService = {
  async getConfig(tenantId: string) {
    const setting = await prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key: PORTAL_CONFIG_KEY } },
    });
    return {
      key: PORTAL_CONFIG_KEY,
      value: setting?.value ?? {},
      updatedAt: setting?.updatedAt ?? null,
    };
  },
  async updateConfig(
    tenantId: string,
    value: Record<string, unknown>,
    actor: TenantActorContext,
  ) {
    return settingService.upsert(tenantId, PORTAL_CONFIG_KEY, value, actor);
  },
  async listForms(tenantId: string) {
    const rows = await prisma.tenantSetting.findMany({
      where: { tenantId, key: { startsWith: PORTAL_FORM_PREFIX } },
      orderBy: { key: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      key: row.key.slice(PORTAL_FORM_PREFIX.length),
      value: row.value,
      updatedAt: row.updatedAt,
    }));
  },
  async upsertForm(
    tenantId: string,
    formKey: string,
    value: Record<string, unknown>,
    actor: TenantActorContext,
  ) {
    return settingService.upsert(
      tenantId,
      `${PORTAL_FORM_PREFIX}${formKey}`,
      value,
      actor,
    );
  },
  async removeForm(
    tenantId: string,
    formKey: string,
    actor: TenantActorContext,
  ) {
    return settingService.remove(
      tenantId,
      `${PORTAL_FORM_PREFIX}${formKey}`,
      actor,
    );
  },
};
