import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";
import { rateLimitWindows } from "../../config/security";
import { RateLimitedError } from "../../shared/errors";

function keyFor(req: Parameters<RequestHandler>[0]): string {
  if (req.auth?.userId) return `user:${req.auth.userId}`;
  return `ip:${req.ip ?? "unknown"}`;
}

function makeLimiter(
  windowMs: number,
  max: number,
  message: string,
): RequestHandler {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyFor,
    handler: (_req, _res, next) => {
      next(new RateLimitedError(message));
    },
  });
}

export const globalLimiter = makeLimiter(
  rateLimitWindows.global.windowMs,
  rateLimitWindows.global.max,
  "Too many requests. Please try again shortly.",
);

export const authLimiter = makeLimiter(
  rateLimitWindows.auth.windowMs,
  rateLimitWindows.auth.max,
  "Too many authentication attempts. Please try again later.",
);

export const passwordResetLimiter = makeLimiter(
  rateLimitWindows.passwordReset.windowMs,
  rateLimitWindows.passwordReset.max,
  "Too many password reset requests. Please try again later.",
);

export const mfaLimiter = makeLimiter(
  rateLimitWindows.mfa.windowMs,
  rateLimitWindows.mfa.max,
  "Too many verification attempts. Please try again later.",
);

export const sensitiveWriteLimiter = makeLimiter(
  rateLimitWindows.sensitiveWrite.windowMs,
  rateLimitWindows.sensitiveWrite.max,
  "Too many write requests. Please slow down.",
);
