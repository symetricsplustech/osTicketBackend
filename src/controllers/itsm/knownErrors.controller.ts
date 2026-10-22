import { makeItsmCrudController } from "./crud.controller";
import { knownErrorService } from "../../services/itsm/knownErrors.service";

export const knownErrorController = makeItsmCrudController(
  knownErrorService,
  "knownErrorId",
);
