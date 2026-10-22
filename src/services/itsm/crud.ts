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
import type { TenantActorContext } from "../tenantadmin/roles.service";

type PrismaModel = {
  findFirst: (args: any) => Promise<unknown | null>;
  findMany: (args: any) => Promise<unknown[]>;
  create: (args: any) => Promise<unknown>;
  update: (args: any) => Promise<unknown>;
  delete: (args: any) => Promise<unknown>;
  count: (args: any) => Promise<number>;
};

export interface ItsmCrudHooks {
  validate?: (
    tenantId: string,
    input: Record<string, unknown>,
    existing?: Record<string, unknown>,
  ) => Promise<void>;
  beforeDelete?: (tenantId: string, record: Record<string, unknown>) => Promise<void>;
  mapInput?: (
    input: Record<string, unknown>,
    ctx: { tenantId: string; actor: TenantActorContext; existing?: Record<string, unknown> },
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
}

export interface ItsmCrudConfig extends ItsmCrudHooks {
  resourceType: string;
  label: string;
  model: PrismaModel;
  searchFields?: string[];
  allowedSortFields?: string[];
  include?: Prisma.InputJsonValue;
  softDelete?: boolean;
  statusField?: string | null;
  filterFields?: string[];
  setCreatedBy?: boolean;
  defaultOrderBy?: Record<string, "asc" | "desc">;
}

export function createItsmCrudService(config: ItsmCrudConfig) {
  const { model } = config;
  const softDelete = config.softDelete ?? true;
  const statusField =
    config.statusField === undefined ? "status" : config.statusField;
  const setCreatedBy = config.setCreatedBy ?? true;

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

  function withInclude(): Record<string, unknown> {
    return config.include ? { include: config.include as unknown } : {};
  }

  return {
    async list(tenantId: string, req: Request) {
      const query = parseListQuery(req, { maxLimit: 100 });
      const where: Record<string, unknown> = {
        tenantId,
        ...(softDelete ? { deletedAt: null } : {}),
      };

      if (statusField && typeof query.status === "string" && query.status) {
        where[statusField] = query.status;
      }
      for (const field of config.filterFields ?? []) {
        const value = (query as Record<string, unknown>)[field];
        if (typeof value === "string" && value) where[field] = value;
      }
      if (query.search && (config.searchFields ?? []).length > 0) {
        where.OR = config.searchFields!.map((field) => ({
          [field]: { contains: query.search, mode: "insensitive" },
        }));
      }

      const orderBy = buildOrderBy(
        query,
        config.allowedSortFields ?? [],
        config.defaultOrderBy ?? { createdAt: "desc" },
      );
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
      const data = config.mapInput
        ? await config.mapInput(input, { tenantId, actor })
        : { ...input };
      if (setCreatedBy) (data as Record<string, unknown> & { createdById?: string | null }).createdById = actor.actorId ?? null;

      const record = await model.create({
        data: { ...data, tenantId },
        ...withInclude(),
      });

      await recordAudit({
        action: `${config.resourceType}.created`,
        resourceType: config.resourceType,
        resourceId: String((record as Record<string, unknown>).id),
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
        payload: { id: String((record as Record<string, unknown>).id) },
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
      const data = config.mapInput
        ? await config.mapInput(input, { tenantId, actor, existing: before })
        : { ...input };

      const record = await model.update({
        where: { id },
        data,
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
      if (softDelete)
        await model.update({ where: { id }, data: { deletedAt: new Date() } });
      else await model.delete({ where: { id } });

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

    /** Transition a record's status column to a target value with an optional extra patch. */
    async transition(
      tenantId: string,
      id: string,
      actor: TenantActorContext,
      action: string,
      targetStatus: string,
      extra: Record<string, unknown> = {},
    ) {
      const before = await findOrThrow(tenantId, id);
      const data: Record<string, unknown> = { ...extra };
      if (statusField) data[statusField] = targetStatus;
      const record = await model.update({
        where: { id },
        data,
        ...withInclude(),
      });

      await recordAudit({
        action: `${config.resourceType}.${action}`,
        resourceType: config.resourceType,
        resourceId: id,
        tenantId,
        before: statusField
          ? { [statusField]: String((before as Record<string, unknown>)[statusField]) }
          : undefined,
        after: statusField ? { [statusField]: String((record as Record<string, unknown>)[statusField]) } : undefined,
        actorId: actor.actorId ?? null,
        actorEmail: actor.actorEmail ?? null,
        actorType: actor.actorType ?? "TENANT_USER",
        req: actor.req,
      });
      void publishEvent({
        eventKey: `${config.resourceType}.${action}`,
        tenantId,
        payload: { id },
      });
      return record;
    },
  };
}

export async function assertUnique(
  model: PrismaModel,
  tenantId: string,
  field: string,
  value: unknown,
  label: string,
  exceptId?: unknown,
): Promise<void> {
  if (value === undefined || value === null || value === "") return;
  const where: Record<string, unknown> = { tenantId, [field]: value };
  if (exceptId) where.id = { not: String(exceptId) };
  const existing = await model.findFirst({ where, select: { id: true } });
  if (existing)
    throw new ConflictError(
      `A ${label.toLowerCase()} with this value already exists in the organization.`,
    );
}
