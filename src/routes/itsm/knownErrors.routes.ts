import { Router } from "express";
import { registerItsmCrudRoutes } from "./crud.routes";
import { knownErrorController } from "../../controllers/itsm/knownErrors.controller";
import {
  createKnownErrorSchema,
  knownErrorIdParamSchema,
  updateKnownErrorSchema,
} from "../../validators/itsm/knownErrors.validators";

export const knownErrorsItsmRouter = Router();

registerItsmCrudRoutes(knownErrorsItsmRouter, knownErrorController, {
  idParam: "knownErrorId",
  read: "known_errors.read",
  manage: "known_errors.manage",
  idSchema: knownErrorIdParamSchema,
  createSchema: createKnownErrorSchema,
  updateSchema: updateKnownErrorSchema,
  transitions: [
    { path: "/resolve", action: "resolved", status: "RESOLVED" },
    { path: "/reopen", action: "reopened", status: "OPEN" },
    { path: "/archive", action: "archived", status: "ARCHIVED" },
  ],
});
