import type { NextFunction, Request, RequestHandler, Response } from "express";
import { recordAudit } from "../../shared/audit";

export interface SensitiveActionOptions {
  action: string;
  resourceType: string;
  resourceId?: (req: Request) => string | undefined;
  tenantId?: (req: Request) => string | undefined;
  describe?: (req: Request) => Record<string, unknown>;
}

export function auditSensitiveAction(
  options: SensitiveActionOptions,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      const success = res.statusCode < 400;
      const body = res.locals["responseBody"] as { data?: unknown } | undefined;
      void recordAudit({
        action: options.action,
        resourceType: options.resourceType,
        resourceId:
          options.resourceId?.(req) ?? (req.params.id as string | undefined),
        tenantId: options.tenantId?.(req),
        outcome: success
          ? "SUCCESS"
          : res.statusCode === 403
            ? "DENIED"
            : "FAILURE",
        metadata: options.describe?.(req),
        after: success ? body?.data : undefined,
        req,
      });
    });
    next();
  };
}
