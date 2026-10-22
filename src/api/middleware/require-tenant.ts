import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors";
import {
  assertAnyTenantPermission,
  assertTenantPermission,
} from "../../shared/permissions/guard";

/**
 * Ensures the request is bound to an authenticated organization membership.
 * The tenant identity is always derived from the authenticated session by the
 * `authenticate` middleware — this guard never trusts a caller-supplied tenant.
 */
export const requireTenantMembership: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.auth) throw new UnauthorizedError("Authentication is required.");
    if (req.auth.userType !== "TENANT_USER") {
      throw new ForbiddenError(
        "This endpoint is only available to organization members.",
      );
    }
    if (
      !req.auth.activeTenantId ||
      !req.auth.membershipId ||
      !req.tenantContext
    ) {
      throw new ForbiddenError(
        "No active organization is selected for this session.",
      );
    }
    next();
  } catch (error) {
    next(error);
  }
};

export function requireTenantPermission(...codes: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (codes.length === 1) assertTenantPermission(req.auth, codes[0]!);
      else assertAnyTenantPermission(req.auth, codes);
      next();
    } catch (error) {
      next(error);
    }
  };
}
