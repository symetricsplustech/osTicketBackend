import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { logger } from './config/logger';
import { helmetOptions } from './config/security';
import { corsMiddleware } from './config/cors';
import { buildOpenApiDocument } from './config/swagger';
import { apiRouter } from './routes';
import { errorHandler, notFound, requestId, globalLimiter } from './api/middleware';
import { maintenanceGate } from './api/middleware/maintenance-gate';
import { registerApprovalExecutors } from './services/saasadmin/approvals.registry';

export function createApp(): express.Express {
  registerApprovalExecutors();
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as unknown as { requestId: string }).requestId,
      autoLogging: {
        ignore: (req) => req.url === `${env.API_PREFIX}/health/live`,
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );
  app.use(helmet(helmetOptions));
  app.use(corsMiddleware);
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: env.APP_NAME,
        version: env.APP_VERSION,
        api: env.API_PREFIX,
        docs: `${env.API_PREFIX}/docs`,
      },
    });
  });

  app.use(env.API_PREFIX, globalLimiter, maintenanceGate, apiRouter);

  app.get(`${env.API_PREFIX}/openapi.json`, (_req, res) => {
    res.json(buildOpenApiDocument());
  });

  app.use(
    `${env.API_PREFIX}/docs`,
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: { url: `${env.API_PREFIX}/openapi.json` },
      customSiteTitle: `${env.APP_NAME} API`,
    }),
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
