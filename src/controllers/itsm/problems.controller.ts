import type { Request, Response } from 'express';
import { ok } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { makeTicketController } from './ticket.controller';
import {
  addProblemComment,
  assignProblem,
  createProblem,
  deleteProblem,
  getProblem,
  listProblemComments,
  listProblems,
  resolveProblem,
  updateProblem,
} from '../../services/itsm/problems.service';
import type { AssignProblemInput, ResolveProblemInput } from '../../validators/itsm/problems.validators';

const base = makeTicketController(
  {
    list: listProblems,
    get: getProblem,
    create: createProblem,
    update: updateProblem,
    remove: deleteProblem,
    listComments: listProblemComments,
    addComment: addProblemComment,
  },
  'problemId',
);

export const problemController = {
  ...base,

  assign: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await assignProblem(actor.tenantId, req.params.problemId!, req.body as AssignProblemInput, actor));
  }),

  resolve: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await resolveProblem(actor.tenantId, req.params.problemId!, req.body as ResolveProblemInput, actor));
  }),
};
