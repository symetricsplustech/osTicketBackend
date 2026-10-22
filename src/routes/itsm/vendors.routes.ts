import { Router } from "express";
import { registerItsmCrudRoutes } from "./crud.routes";
import { vendorController } from "../../controllers/itsm/vendors.controller";
import {
  createVendorSchema,
  updateVendorSchema,
  vendorIdParamSchema,
} from "../../validators/itsm/vendors.validators";

export const vendorsItsmRouter = Router();

registerItsmCrudRoutes(vendorsItsmRouter, vendorController, {
  idParam: "vendorId",
  read: "vendors.read",
  manage: "vendors.manage",
  idSchema: vendorIdParamSchema,
  createSchema: createVendorSchema,
  updateSchema: updateVendorSchema,
  transitions: [
    { path: "/activate", action: "activated", status: "ACTIVE" },
    { path: "/deactivate", action: "deactivated", status: "INACTIVE" },
    { path: "/blacklist", action: "blacklisted", status: "BLACKLISTED" },
  ],
});
