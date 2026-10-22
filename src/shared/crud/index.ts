/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request } from "express";
import { NotFoundError } from "../errors";
import {
  buildOrderBy,
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
  type ListQuery,
} from "../pagination";
import type { PaginationMeta } from "../response";
import { recordAudit } from "../audit";
import { publishEvent } from "../events";

export interface CrudModelDelegate {
  findMany(args?: any): Promise<any[]>;
  count(args?: any): Promise<number>;
  findFirst(args?: any): Promise<any | null>;
  create(args: any): Promise<any>;
  update(args: any): Promise<any>;
  delete(args: any): Promise<any>;
  updateMany(args: any): Promise<{ count: number }>;
}

export interface CrudServiceOptions {
  model: CrudModelDelegate;
  resourceType: string;
  searchFields?: string[];
  filterableFields?: string[];
  allowedSortFields: string[];
  defaultOrderBy?: Record<string, "asc" | "desc">;
  softDelete?: boolean;
  include?: any;
  events?: { created?: string; updated?: string; deleted?: string };
  dateField?: string;
}

export interface CrudListResult<T> {
  rows: T[];
  meta: PaginationMeta;
  query: ListQuery;
}

function buildWhere(
  options: CrudServiceOptions,
  query: ListQuery,
  extraWhere?: Record<string, unknown>,
): Record<string, unknown> {
  const where: Record<string, unknown> = { ...(extraWhere ?? {}) };
  if (options.softDelete) where["deletedAt"] = null;

  if (query.search && options.searchFields && options.searchFields.length > 0) {
    where["OR"] = options.searchFields.map((field) => ({
      [field]: { contains: query.search, mode: "insensitive" },
    }));
  }

  if (options.filterableFields) {
    for (const field of options.filterableFields) {
      const value = query[field];
      if (value === undefined || value === "" || value === null) continue;
      if (typeof value === "string" && value.includes(",")) {
        where[field] = { in: value.split(",").map((entry) => entry.trim()) };
      } else {
        where[field] = value;
      }
    }
  }

  if (options.dateField) {
    const from = query["from"];
    const to = query["to"];
    if ((from || to) && !where[options.dateField]) {
      where[options.dateField] = {
        ...(from ? { gte: new Date(String(from)) } : {}),
        ...(to ? { lte: new Date(String(to)) } : {}),
      };
    }
  }

  return where;
}

export function createCrudService<T = any>(options: CrudServiceOptions) {
  const include = options.include;

  return {
    options,

    async list(
      req: Request,
      extraWhere?: Record<string, unknown>,
    ): Promise<CrudListResult<T>> {
      const query = parseListQuery(req, {
        defaultSortBy: undefined,
        defaultSortOrder: "desc",
      });
      const where = buildWhere(options, query, extraWhere);
      const orderBy = buildOrderBy(
        query,
        options.allowedSortFields,
        options.defaultOrderBy ?? { createdAt: "desc" },
      );

      const [rows, total] = await Promise.all([
        options.model.findMany({
          where,
          orderBy,
          ...paginationArgs(query),
          ...(include ? { include } : {}),
        }),
        options.model.count({ where }),
      ]);

      return {
        rows: rows as T[],
        meta: buildPaginationMeta(query.page, query.limit, total),
        query,
      };
    },

    async getById(
      id: string,
      extraWhere?: Record<string, unknown>,
    ): Promise<T> {
      const where: Record<string, unknown> = { id, ...(extraWhere ?? {}) };
      if (options.softDelete) where["deletedAt"] = null;
      const record = await options.model.findFirst({
        where,
        ...(include ? { include } : {}),
      });
      if (!record) throw new NotFoundError(resourceLabel(options.resourceType));
      return record as T;
    },

    async create(
      data: Record<string, unknown>,
      req: Request,
      extra?: Record<string, unknown>,
    ): Promise<T> {
      const record = await options.model.create({
        data: { ...data, ...(extra ?? {}) },
        ...(include ? { include } : {}),
      });
      await recordAudit({
        action: `${options.resourceType}.created`,
        resourceType: options.resourceType,
        resourceId: record.id,
        tenantId: record.tenantId ?? undefined,
        after: record,
        req,
      });
      if (options.events?.created) {
        void publishEvent({
          eventKey: options.events.created,
          tenantId: record.tenantId ?? null,
          payload: { id: record.id, resourceType: options.resourceType },
        });
      }
      return record as T;
    },

    async update(
      id: string,
      data: Record<string, unknown>,
      req: Request,
      extraWhere?: Record<string, unknown>,
    ): Promise<T> {
      const before = await this.getById(id, extraWhere);
      const record = await options.model.update({
        where: { id },
        data,
        ...(include ? { include } : {}),
      });
      await recordAudit({
        action: `${options.resourceType}.updated`,
        resourceType: options.resourceType,
        resourceId: id,
        tenantId: record.tenantId ?? undefined,
        before,
        after: record,
        req,
      });
      if (options.events?.updated) {
        void publishEvent({
          eventKey: options.events.updated,
          tenantId: record.tenantId ?? null,
          payload: { id, resourceType: options.resourceType },
        });
      }
      return record as T;
    },

    async remove(
      id: string,
      req: Request,
      extraWhere?: Record<string, unknown>,
    ): Promise<void> {
      const before = await this.getById(id, extraWhere);
      if (options.softDelete) {
        await options.model.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      } else {
        await options.model.delete({ where: { id } });
      }
      await recordAudit({
        action: `${options.resourceType}.deleted`,
        resourceType: options.resourceType,
        resourceId: id,
        tenantId: (before as any).tenantId ?? undefined,
        before,
        req,
      });
      if (options.events?.deleted) {
        void publishEvent({
          eventKey: options.events.deleted,
          tenantId: (before as any).tenantId ?? null,
          payload: { id, resourceType: options.resourceType },
        });
      }
    },

    buildWhere(
      query: ListQuery,
      extraWhere?: Record<string, unknown>,
    ): Record<string, unknown> {
      return buildWhere(options, query, extraWhere);
    },
  };
}

export type CrudService<T = any> = ReturnType<typeof createCrudService<T>>;

export function resourceLabel(resourceType: string): string {
  return resourceType
    .split(/[.\-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
