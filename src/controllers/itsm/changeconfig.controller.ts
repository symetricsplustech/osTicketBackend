import { makeItsmCrudController } from "./crud.controller";
import {
  changeTemplateService,
  changeTypeService,
  changeWindowService,
} from "../../services/itsm/changeconfig.service";

export const changeTypeController = makeItsmCrudController(
  changeTypeService,
  "changeTypeId",
);
export const changeTemplateController = makeItsmCrudController(
  changeTemplateService,
  "changeTemplateId",
);
export const changeWindowController = makeItsmCrudController(
  changeWindowService,
  "changeWindowId",
);
