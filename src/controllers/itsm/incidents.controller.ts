import type { Request, Response } from "express";
import { created, noContent, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import {
  addIncidentComment,
  assignIncident,
  createIncident,
  deleteIncident,
  escalateIncident,
  getIncident,
  listIncidentComments,
  listIncidents,
  reopenIncident,
  resolveIncident,
  updateIncident,
} from "../../services/itsm/incidents.service";
import type {
  AssignIncidentInput,
  CreateIncidentCommentInput,
  CreateIncidentInput,
  EscalateIncidentInput,
  ReopenIncidentInput,
  ResolveIncidentInput,
  UpdateIncidentInput,
} from "../../validators/itsm/incidents.validators";

export const incidentController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await listIncidents(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await getIncident(actor.tenantId, req.params.incidentId!));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await createIncident(
        actor.tenantId,
        req.body as CreateIncidentInput,
        actor,
      ),
    );
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await updateIncident(
        actor.tenantId,
        req.params.incidentId!,
        req.body as UpdateIncidentInput,
        actor,
      ),
    );
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    await deleteIncident(actor.tenantId, req.params.incidentId!, actor);
    return noContent(res);
  }),

  assign: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await assignIncident(
        actor.tenantId,
        req.params.incidentId!,
        req.body as AssignIncidentInput,
        actor,
      ),
    );
  }),

  escalate: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await escalateIncident(
        actor.tenantId,
        req.params.incidentId!,
        req.body as EscalateIncidentInput,
        actor,
      ),
    );
  }),

  resolve: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await resolveIncident(
        actor.tenantId,
        req.params.incidentId!,
        req.body as ResolveIncidentInput,
        actor,
      ),
    );
  }),

  reopen: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await reopenIncident(
        actor.tenantId,
        req.params.incidentId!,
        req.body as ReopenIncidentInput,
        actor,
      ),
    );
  }),

  listComments: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await listIncidentComments(
      actor.tenantId,
      req.params.incidentId!,
      req,
    );
    return paginated(res, rows, meta);
  }),

  addComment: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await addIncidentComment(
        actor.tenantId,
        req.params.incidentId!,
        req.body as CreateIncidentCommentInput,
        actor,
      ),
    );
  }),
};
