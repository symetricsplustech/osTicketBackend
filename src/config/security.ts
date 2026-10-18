import type { HelmetOptions } from 'helmet';
import { isProd } from './env';

export const helmetOptions: HelmetOptions = {
  contentSecurityPolicy: isProd
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      }
    : false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
};

export const rateLimitWindows = {
  global: { windowMs: 60 * 1000, max: 600 },
  auth: { windowMs: 15 * 60 * 1000, max: 30 },
  passwordReset: { windowMs: 60 * 60 * 1000, max: 10 },
  mfa: { windowMs: 15 * 60 * 1000, max: 20 },
  sensitiveWrite: { windowMs: 60 * 1000, max: 120 },
} as const;

export const passwordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
};
