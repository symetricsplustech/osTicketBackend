import { makeItsmCrudController } from "./crud.controller";
import {
  problemCategoryService,
  rootCauseCategoryService,
} from "../../services/itsm/problemconfig.service";

export const problemCategoryController = makeItsmCrudController(
  problemCategoryService,
  "problemCategoryId",
);
export const rootCauseCategoryController = makeItsmCrudController(
  rootCauseCategoryService,
  "rootCauseCategoryId",
);
