/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../shared/errors";
import {
  buildOrderBy,
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import { publishEvent } from "../../shared/events";
import type { TenantActorContext } from "./roles.service";

type PrismaModel = {
  findFirst: (args: any) => Promise<unknown | null>;
  findMany: (args: any) => Promise<unknown[]>;
  create: (args: any) => Promise<unknown>;
  update: (args: any) => Promise<unknown>;
  delete: (args: any) => Promise<unknown>;
  count: (args: any) => Promise<number>;
};

export interface TenantCrudConfig {
  resourceType: string;
  label: string;
  model: PrismaModel;
  searchFields: string[];
  allowedSortFields: string[];
  include?: Prisma.InputJsonValue;
  softDelete?: boolean;
  codeField?: string;
  validate?: (
    tenantId: string,
    input: Record<string, unknown>,
    existing?: Record<string, unknown>,
  ) => Promise<void>;
  beforeDelete?: (tenantId: string, record: Record<string, unknown>) => Promise<void>;
}

export function createTenantCrudService(config: TenantCrudConfig) {
  const { model } = config;
  const softDelete = config.softDelete ?? true;

  async function findOrThrow(tenantId: string, id: string): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = { id, tenantId };
    if (softDelete) where.deletedAt = null;
    const record = await model.findFirst({
      where,
      ...(config.include ? { include: config.include as Prisma.InputJsonValue } : {}),
    });
    if (!record) throw new NotFoundError(config.label);
    return record as Record<string, unknown>;
  }

  async function assertUniqueCode(
    tenantId: string,
    code: unknown,
    exceptId?: string,
  ): Promise<void> {
    if (!config.codeField || code === undefined || code === null || code === "")
      return;
    const where: Record<string, unknown> = { tenantId, [config.codeField]: code };
    if (exceptId) where.id = { not: exceptId };
    const existing = await model.findFirst({ where, select: { id: true } });
    if (existing) {
      throw new ConflictError(
        `A ${config.label.toLowerCase()} with this code already exists in the organization.`,
      );
    }
  }

  function withInclude(): Record<string, unknown> {
    return config.include ? { include: config.include as Prisma.InputJsonValue } : {};
  }

  return {
    async list(tenantId: string, req: Request) {
      const query = parseListQuery(req, { maxLimit: 100 });
      const status =
        typeof query.status === "string" && query.status
          ? query.status.toUpperCase()
          : undefined;

      const where: Record<string, unknown> = {
        tenantId,
        ...(softDelete ? { deletedAt: null } : {}),
        ...(status ? { status } : {}),
      };
      if (query.search && config.searchFields.length > 0) {
        where.OR = config.searchFields.map((field) => ({
          [field]: { contains: query.search, mode: "insensitive" },
        }));
      }

      const orderBy = buildOrderBy(query, config.allowedSortFields, {
        createdAt: "desc",
      });
      const [rows, total] = await Promise.all([
        model.findMany({
          where,
          orderBy,
          ...paginationArgs(query),
          ...withInclude(),
        }),
        model.count({ where }),
      ]);

      return {
        rows,
        meta: buildPaginationMeta(query.page, query.limit, total),
      };
    },

    async get(tenantId: string, id: string) {
      return findOrThrow(tenantId, id);
    },

    async create(
      tenantId: string,
      input: Record<string, unknown>,
      actor: TenantActorContext,
    ) {
      if (config.validate) await config.validate(tenantId, input);
      await assertUniqueCode(
        tenantId,
        config.codeField ? input[config.codeField] : undefined,
      );

      const record = await model.create({
        data: { ...input, tenantId, createdById: actor.actorId ?? null },
        ...withInclude(),
      });

      await recordAudit({
        action: `${config.resourceType}.created`,
        resourceType: config.resourceType,
        resourceId: (record as Record<string, unknown>).id,
        tenantId,
        after: record,
        actorId: actor.actorId ?? null,
        actorEmail: actor.actorEmail ?? null,
        actorType: actor.actorType ?? "TENANT_USER",
        req: actor.req,
      });
      void publishEvent({
        eventKey: `${config.resourceType}.created`,
        tenantId,
        payload: { id: (record as Record<string, unknown>).id },
      });

      return record;
    },

    async update(
      tenantId: string,
      id: string,
      input: Record<string, unknown>,
      actor: TenantActorContext,
    ) {
      const before = await findOrThrow(tenantId, id);
      if (config.validate) await config.validate(tenantId, input, before);
      if (config.codeField && input[config.codeField] !== undefined) {
        await assertUniqueCode(tenantId, input[config.codeField], id);
      }

      const record = await model.update({
        where: { id },
        data: input,
        ...withInclude(),
      });

      await recordAudit({
        action: `${config.resourceType}.updated`,
        resourceType: config.resourceType,
        resourceId: id,
        tenantId,
        before,
        after: record,
        actorId: actor.actorId ?? null,
        actorEmail: actor.actorEmail ?? null,
        actorType: actor.actorType ?? "TENANT_USER",
        req: actor.req,
      });
      void publishEvent({
        eventKey: `${config.resourceType}.updated`,
        tenantId,
        payload: { id },
      });

      return record;
    },

    async remove(tenantId: string, id: string, actor: TenantActorContext) {
      const before = await findOrThrow(tenantId, id);
      if (config.beforeDelete) await config.beforeDelete(tenantId, before);
      if (softDelete) {
        await model.update({ where: { id }, data: { deletedAt: new Date() } });
      } else {
        await model.delete({ where: { id } });
      }

      await recordAudit({
        action: `${config.resourceType}.deleted`,
        resourceType: config.resourceType,
        resourceId: id,
        tenantId,
        before,
        actorId: actor.actorId ?? null,
        actorEmail: actor.actorEmail ?? null,
        actorType: actor.actorType ?? "TENANT_USER",
        req: actor.req,
      });
      void publishEvent({
        eventKey: `${config.resourceType}.deleted`,
        tenantId,
        payload: { id },
      });
    },
  };
}
