import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { registerItsmCrudRoutes } from "./crud.routes";
import {
  onCallScheduleController,
  onCallShiftController,
} from "../../controllers/itsm/oncall.controller";
import {
  createOnCallScheduleSchema,
  createOnCallShiftSchema,
  onCallScheduleIdParamSchema,
  onCallShiftIdParamSchema,
  updateOnCallScheduleSchema,
  updateOnCallShiftSchema,
} from "../../validators/itsm/oncall.validators";

export const onCallItsmRouter = Router();

registerItsmCrudRoutes(onCallItsmRouter, onCallScheduleController, {
  idParam: "scheduleId",
  basePath: "/schedules",
  read: "on_call.read",
  manage: "on_call.manage",
  idSchema: onCallScheduleIdParamSchema,
  createSchema: createOnCallScheduleSchema,
  updateSchema: updateOnCallScheduleSchema,
});
onCallItsmRouter.get(
  "/schedules/:scheduleId/shifts",
  requireTenantPermission("on_call.read"),
  validateRequest({ params: onCallScheduleIdParamSchema }),
  onCallScheduleController.listShifts,
);
onCallItsmRouter.post(
  "/schedules/:scheduleId/shifts",
  requireTenantPermission("on_call.manage"),
  validateRequest({
    params: onCallScheduleIdParamSchema,
    body: createOnCallShiftSchema.omit({ scheduleId: true }),
  }),
  onCallScheduleController.createShift,
);

onCallItsmRouter.get(
  "/shifts/:shiftId",
  requireTenantPermission("on_call.read"),
  validateRequest({ params: onCallShiftIdParamSchema }),
  onCallShiftController.get,
);
onCallItsmRouter.patch(
  "/shifts/:shiftId",
  requireTenantPermission("on_call.manage"),
  validateRequest({
    params: onCallShiftIdParamSchema,
    body: updateOnCallShiftSchema,
  }),
  onCallShiftController.update,
);
onCallItsmRouter.delete(
  "/shifts/:shiftId",
  requireTenantPermission("on_call.manage"),
  validateRequest({ params: onCallShiftIdParamSchema }),
  onCallShiftController.remove,
);
