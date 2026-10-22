import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { makeItsmCrudController } from "./crud.controller";
import {
  getOnCallShift,
  onCallScheduleService,
  onCallShiftService,
} from "../../services/itsm/oncall.service";

const base = makeItsmCrudController(onCallScheduleService, "scheduleId");

export const onCallScheduleController = {
  ...base,
  listShifts: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await onCallScheduleService.listShifts(
      actor.tenantId,
      req.params.scheduleId!,
      req,
    );
    return paginated(res, rows, meta);
  }),
  createShift: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await onCallShiftService.create(
        actor.tenantId,
        { ...(req.body ?? {}), scheduleId: req.params.scheduleId },
        actor,
      ),
    );
  }),
};

const shiftBase = makeItsmCrudController(onCallShiftService, "shiftId");

export const onCallShiftController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await getOnCallShift(actor.tenantId, req.params.shiftId!));
  }),
  update: shiftBase.update,
  remove: shiftBase.remove,
};
