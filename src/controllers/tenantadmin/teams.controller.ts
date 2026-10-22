import type { Request, Response } from "express";
import { ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { makeStructureController } from "./structure.controller";
import { tenantActor } from "./actor";
import {
  addTeamMember,
  assignTeamQueue,
  listTeamMembers,
  listTeamQueues,
  removeTeamMember,
  teamService,
  unassignTeamQueue,
} from "../../services/tenantadmin/teams.service";
import type {
  AddTeamMemberInput,
  AssignTeamQueueInput,
} from "../../validators/tenantadmin/teams.validators";

const base = makeStructureController(teamService, "teamId");

export const teamController = {
  ...base,

  listMembers: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await listTeamMembers(
      actor.tenantId,
      req.params.teamId!,
      req,
    );
    return paginated(res, rows, meta);
  }),

  addMember: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await addTeamMember(
        actor.tenantId,
        req.params.teamId!,
        req.body as AddTeamMemberInput,
        actor,
      ),
    );
  }),

  removeMember: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    await removeTeamMember(
      actor.tenantId,
      req.params.teamId!,
      req.params.userId!,
      actor,
    );
    return ok(res, {
      teamId: req.params.teamId,
      userId: req.params.userId,
      removed: true,
    });
  }),

  listQueues: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await listTeamQueues(
      actor.tenantId,
      req.params.teamId!,
      req,
    );
    return paginated(res, rows, meta);
  }),

  assignQueue: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await assignTeamQueue(
        actor.tenantId,
        req.params.teamId!,
        req.body as AssignTeamQueueInput,
        actor,
      ),
    );
  }),

  unassignQueue: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await unassignTeamQueue(
        actor.tenantId,
        req.params.teamId!,
        req.params.queueId!,
        actor,
      ),
    );
  }),
};
