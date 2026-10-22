import type { Request, Response } from "express";
import { ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { securityService } from "../../services/itsm/security.service";
import { auditService } from "../../services/itsm/audit.service";

export const securityController = {
  overview: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await securityService.overview(tenantActor(req).tenantId)),
  ),
  listEvents: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await auditService.listSecurityEvents(
      actor.tenantId,
      req,
    );
    return paginated(res, rows, meta);
  }),
  listSessions: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await securityService.listSessions(
      actor.tenantId,
      req,
    );
    return paginated(res, rows, meta);
  }),
  revokeSession: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await securityService.revokeSession(
        actor.tenantId,
        req.params.sessionId!,
        actor,
      ),
    );
  }),
};
