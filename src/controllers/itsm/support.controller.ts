import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { supportService } from "../../services/itsm/support.service";

export const supportController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await supportService.list(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await supportService.get(actor.tenantId, req.params.ticketId!),
    );
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await supportService.create(actor.tenantId, req.body, actor),
    );
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await supportService.update(
        actor.tenantId,
        req.params.ticketId!,
        req.body,
        actor,
      ),
    );
  }),
  reply: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await supportService.reply(
        actor.tenantId,
        req.params.ticketId!,
        req.body,
        actor,
      ),
    );
  }),
  resolve: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await supportService.transition(
        actor.tenantId,
        req.params.ticketId!,
        "RESOLVED",
        actor,
      ),
    );
  }),
  close: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await supportService.transition(
        actor.tenantId,
        req.params.ticketId!,
        "CLOSED",
        actor,
      ),
    );
  }),
  reopen: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await supportService.transition(
        actor.tenantId,
        req.params.ticketId!,
        "REOPENED",
        actor,
      ),
    );
  }),
};
