import type { NextFunction, Request, RequestHandler, Response } from "express";
import { prisma } from "../../config/database";
import { NotFoundError, PreconditionFailedError } from "../../shared/errors";

export function tenantContext(paramName = "tenantId"): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const tenantId =
        req.params[paramName] ??
        (req.headers["x-tenant-id"] as string | undefined);
      if (!tenantId) {
        next(new NotFoundError("Tenant"));
        return;
      }
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, deletedAt: null },
        select: { id: true, slug: true, name: true, status: true },
      });
      if (!tenant) throw new NotFoundError("Tenant");
      if (tenant.status === "ARCHIVED") {
        throw new PreconditionFailedError(
          "Tenant is archived and can no longer be modified.",
        );
      }
      req.tenantContext = {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireTenantContext(req: Request): {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
} {
  if (!req.tenantContext) throw new NotFoundError("Tenant");
  return req.tenantContext;
}
