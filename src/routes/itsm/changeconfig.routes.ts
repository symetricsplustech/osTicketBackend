import { Router } from "express";
import { registerItsmCrudRoutes } from "./crud.routes";
import {
  changeTemplateController,
  changeTypeController,
} from "../../controllers/itsm/changeconfig.controller";
import {
  changeTemplateIdParamSchema,
  changeTypeIdParamSchema,
  createChangeTemplateSchema,
  createChangeTypeSchema,
  updateChangeTemplateSchema,
  updateChangeTypeSchema,
} from "../../validators/itsm/changeconfig.validators";

export const changeConfigItsmRouter = Router();

registerItsmCrudRoutes(changeConfigItsmRouter, changeTypeController, {
  idParam: "changeTypeId",
  basePath: "/types",
  read: "change_configuration.read",
  manage: "change_configuration.manage",
  idSchema: changeTypeIdParamSchema,
  createSchema: createChangeTypeSchema,
  updateSchema: updateChangeTypeSchema,
});

registerItsmCrudRoutes(changeConfigItsmRouter, changeTemplateController, {
  idParam: "changeTemplateId",
  basePath: "/templates",
  read: "change_configuration.read",
  manage: "change_configuration.manage",
  idSchema: changeTemplateIdParamSchema,
  createSchema: createChangeTemplateSchema,
  updateSchema: updateChangeTemplateSchema,
});
