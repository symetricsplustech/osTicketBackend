import type { Request, Response } from "express";
import { created, noContent, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  createCustomerContact,
  createCustomerSite,
  customerService,
  inviteCustomerContactPortal,
  listCustomerContacts,
  listCustomerSites,
  removeCustomerContact,
  removeCustomerSite,
  revokeCustomerContactPortal,
  updateCustomerContact,
  updateCustomerSite,
} from "../../services/tenantadmin/customers.service";
import { makeStructureController } from "./structure.controller";
import { tenantActor } from "./actor";

const baseController = makeStructureController(customerService, "customerId");

export const customerController = {
  ...baseController,

  listContacts: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await listCustomerContacts(actor.tenantId, req);
    return paginated(res, rows, meta as never);
  }),

  createContact: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await createCustomerContact(
        actor.tenantId,
        req.params.customerId!,
        req.body ?? {},
        actor,
      ),
    );
  }),

  updateContact: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await updateCustomerContact(
        actor.tenantId,
        req.params.customerId!,
        req.params.contactId!,
        req.body ?? {},
        actor,
      ),
    );
  }),

  removeContact: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    await removeCustomerContact(
      actor.tenantId,
      req.params.customerId!,
      req.params.contactId!,
      actor,
    );
    return noContent(res);
  }),

  inviteContactPortal: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await inviteCustomerContactPortal(
        actor.tenantId,
        req.params.customerId!,
        req.params.contactId!,
        actor,
      ),
    );
  }),

  revokeContactPortal: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await revokeCustomerContactPortal(
        actor.tenantId,
        req.params.customerId!,
        req.params.contactId!,
        actor,
      ),
    );
  }),

  listSites: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await listCustomerSites(actor.tenantId, req);
    return paginated(res, rows, meta as never);
  }),

  createSite: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await createCustomerSite(
        actor.tenantId,
        req.params.customerId!,
        req.body ?? {},
        actor,
      ),
    );
  }),

  updateSite: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await updateCustomerSite(
        actor.tenantId,
        req.params.customerId!,
        req.params.siteId!,
        req.body ?? {},
        actor,
      ),
    );
  }),

  removeSite: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    await removeCustomerSite(
      actor.tenantId,
      req.params.customerId!,
      req.params.siteId!,
      actor,
    );
    return noContent(res);
  }),
};
