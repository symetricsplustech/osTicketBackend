import { makeItsmCrudController } from "./crud.controller";
import {
  incidentCategoryService,
  incidentPriorityService,
  resolutionCodeService,
} from "../../services/itsm/incidentconfig.service";

export const incidentCategoryController = makeItsmCrudController(
  incidentCategoryService,
  "categoryId",
);
export const incidentPriorityController = makeItsmCrudController(
  incidentPriorityService,
  "priorityId",
);
export const resolutionCodeController = makeItsmCrudController(
  resolutionCodeService,
  "resolutionCodeId",
);
