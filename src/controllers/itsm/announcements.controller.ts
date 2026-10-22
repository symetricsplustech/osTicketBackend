import { makeItsmCrudController } from "./crud.controller";
import { announcementService } from "../../services/itsm/announcements.service";

export const announcementController = makeItsmCrudController(
  announcementService,
  "announcementId",
);
