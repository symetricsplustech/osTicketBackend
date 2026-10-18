import pino from 'pino';
import { env, isProd, isTest } from './env';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.secret',
  'req.body.apiKey',
  'req.body.config',
  'req.body.credentials',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.refreshToken',
  '*.secretEnc',
  '*.configEnc',
];

export const logger = pino({
  level: isTest ? 'silent' : isProd ? 'info' : 'debug',
  base: { service: 'itsm-saas-backend', env: env.NODE_ENV },
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: !isProd && !isTest ? { target: 'pino/file', options: { destination: 1 } } : undefined,
});

export type Logger = typeof logger;
