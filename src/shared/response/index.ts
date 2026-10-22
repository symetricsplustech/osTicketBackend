import type { Response } from "express";
import type { ErrorDetail } from "../errors";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown> | PaginationMeta;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
    meta?: Record<string, unknown>;
  };
}

export function ok<T>(
  res: Response,
  data: T,
  meta?: Record<string, unknown> | PaginationMeta,
  status = 200,
): Response {
  const requestId = res.req?.requestId;
  const mergedMeta = { ...(meta ?? {}), ...(requestId ? { requestId } : {}) };
  const body: ApiSuccessBody<T> = { success: true, data };
  if (meta || requestId) body.meta = mergedMeta;
  res.locals["responseBody"] = body;
  return res.status(status).json(body);
}

export function created<T>(
  res: Response,
  data: T,
  meta?: Record<string, unknown>,
): Response {
  return ok(res, data, meta, 201);
}

export function accepted<T>(
  res: Response,
  data: T,
  meta?: Record<string, unknown>,
): Response {
  return ok(res, data, meta, 202);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function paginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
): Response {
  return ok(res, data, meta);
}

export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: ErrorDetail[],
  meta?: Record<string, unknown>,
): Response {
  const body: ApiErrorBody = { success: false, error: { code, message } };
  if (details && details.length) body.error.details = details;
  if (meta) body.error.meta = meta;
  return res.status(status).json(body);
}
