import { Router } from "express";
import { registerItsmCrudRoutes } from "./crud.routes";
import { changeWindowController } from "../../controllers/itsm/changeconfig.controller";
import {
  changeWindowIdParamSchema,
  createChangeWindowSchema,
  updateChangeWindowSchema,
} from "../../validators/itsm/changeconfig.validators";

export const changeCalendarItsmRouter = Router();

registerItsmCrudRoutes(changeCalendarItsmRouter, changeWindowController, {
  idParam: "changeWindowId",
  basePath: "/windows",
  read: "change_calendar.read",
  manage: "change_calendar.manage",
  idSchema: changeWindowIdParamSchema,
  createSchema: createChangeWindowSchema,
  updateSchema: updateChangeWindowSchema,
});
