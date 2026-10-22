import { makeStructureController } from "./structure.controller";
import { departmentService } from "../../services/tenantadmin/departments.service";

export const departmentController = makeStructureController(
  departmentService,
  "departmentId",
);
