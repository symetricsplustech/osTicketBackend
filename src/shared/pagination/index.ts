import type { Request } from "express";
import type { PaginationMeta } from "../response";

export interface ListQuery {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder: "asc" | "desc";
  [key: string]: unknown;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

export function parseListQuery(
  req: Request,
  options?: {
    defaultSortBy?: string;
    defaultSortOrder?: "asc" | "desc";
    maxLimit?: number;
  },
): ListQuery {
  const query = req.query as Record<string, unknown>;
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const requestedLimit =
    Number.parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
  const limit = Math.min(
    Math.max(1, requestedLimit),
    options?.maxLimit ?? MAX_LIMIT,
  );
  const sortOrder =
    String(
      query.sortOrder ?? options?.defaultSortOrder ?? "desc",
    ).toLowerCase() === "asc"
      ? "asc"
      : "desc";
  const search =
    typeof query.search === "string" && query.search.trim()
      ? query.search.trim()
      : undefined;

  return {
    ...query,
    page,
    limit,
    search,
    sortBy:
      typeof query.sortBy === "string" && query.sortBy
        ? query.sortBy
        : options?.defaultSortBy,
    sortOrder,
  };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
}

export function paginationArgs(query: ListQuery): {
  skip: number;
  take: number;
} {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

export function buildOrderBy<T extends Record<string, unknown>>(
  query: ListQuery,
  allowedFields: string[],
  fallback: T,
): T {
  if (!query.sortBy || !allowedFields.includes(query.sortBy)) return fallback;
  return { [query.sortBy]: query.sortOrder } as T;
}
