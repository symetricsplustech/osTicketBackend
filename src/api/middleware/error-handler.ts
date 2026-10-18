import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env, isProd } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../shared/errors';
import { fail } from '../../shared/response';
import { recordSecurityEvent } from '../../shared/audit';

export function notFound(req: Request, res: Response): Response {
  return fail(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} does not exist.`);
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): Response {
  if (res.headersSent) {
    return res.end();
  }

  if (error instanceof AppError && error.code === 'APPROVAL_REQUIRED') {
    return fail(res, 202, error.code, error.message, error.details, error.meta);
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error({ error, requestId: req.requestId }, 'Application error');
    }
    return fail(res, error.statusCode, error.code, error.expose ? error.message : 'An unexpected error occurred.', error.details, error.meta);
  }

  if (error instanceof ZodError) {
    return fail(
      res,
      422,
      'VALIDATION_ERROR',
      'Request validation failed.',
      error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
        code: issue.code,
      })),
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.['target']) ? (error.meta['target'] as string[]).join(', ') : 'field';
      return fail(res, 409, 'CONFLICT', `A record with the same ${target} already exists.`);
    }
    if (error.code === 'P2025') {
      return fail(res, 404, 'NOT_FOUND', 'The requested record was not found.');
    }
    if (error.code === 'P2003') {
      return fail(res, 409, 'CONFLICT', 'The operation violates a related record constraint.');
    }
    if (error.code === 'P2014') {
      return fail(res, 409, 'CONFLICT', 'The change would invalidate a required relation between records.');
    }
    if (error.code === 'P2021' || error.code === 'P2022') {
      logger.error({ error, requestId: req.requestId }, 'Database schema is out of date');
      return fail(
        res,
        503,
        'SERVICE_UNAVAILABLE',
        'The database schema is out of date. Apply pending migrations before using this endpoint.',
      );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return fail(res, 400, 'BAD_REQUEST', 'The provided data is not valid for this operation.');
  }

  const message = error instanceof Error ? error.message : 'Unknown error';

  if (/CORS policy/i.test(message)) {
    return fail(res, 403, 'FORBIDDEN', 'Origin is not allowed.');
  }

  logger.error({ error, requestId: req.requestId, path: req.originalUrl }, 'Unhandled error');

  void recordSecurityEvent({
    eventType: 'server.unhandled_error',
    severity: 'MEDIUM',
    req,
    details: { message: message.slice(0, 300), path: req.originalUrl },
  });

  return fail(
    res,
    500,
    'INTERNAL_ERROR',
    isProd ? 'An unexpected error occurred. Please contact support with the request id.' : message,
    undefined,
    { requestId: req.requestId, version: env.APP_VERSION },
  );
}
