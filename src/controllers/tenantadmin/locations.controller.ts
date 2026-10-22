import { makeStructureController } from "./structure.controller";
import { locationService } from "../../services/tenantadmin/locations.service";

export const locationController = makeStructureController(
  locationService,
  "locationId",
);
