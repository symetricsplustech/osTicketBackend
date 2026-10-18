import { Router } from 'express';
import { ok } from '../shared/response';
import { asyncHandler } from '../shared/utils/async-handler';
import { env } from '../config/env';
import { checkDatabase, checkInfrastructure } from '../database/health-check';

export const healthRouter = Router();

healthRouter.get(
  '/live',
  asyncHandler(async (_req, res) => ok(res, { status: 'alive', version: env.APP_VERSION, timestamp: new Date().toISOString() })),
);

healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const database = await checkDatabase();
    if (!database.ok) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Required dependencies are not ready.' },
        data: { status: 'not-ready', database },
      });
    }
    return ok(res, { status: 'ready', database });
  }),
);

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const infrastructure = await checkInfrastructure();
    return ok(res, {
      status: infrastructure.database.ok ? 'healthy' : 'degraded',
      version: env.APP_VERSION,
      environment: env.NODE_ENV,
      uptimeSeconds: infrastructure.uptimeSeconds,
    });
  }),
);
