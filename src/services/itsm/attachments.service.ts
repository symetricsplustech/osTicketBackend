import { prisma } from "../../config/database";
import { createItsmCrudService } from "./crud";

export const attachmentService = createItsmCrudService({
  resourceType: "attachment",
  label: "Attachment",
  model: prisma.tenantAttachment,
  statusField: null,
  setCreatedBy: false,
  searchFields: ["name", "filename", "mimeType"],
  allowedSortFields: ["name", "filename", "size", "createdAt"],
  filterFields: ["resourceType", "resourceId", "mimeType"],
  mapInput: (input, { actor, existing }) => {
    const data: Record<string, unknown> = { ...input };
    if (!existing) data.uploadedById = actor.actorId ?? null;
    return data;
  },
});
