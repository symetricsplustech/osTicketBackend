import type { Request, Response } from 'express';
import { ok } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { makeTicketController } from './ticket.controller';
import {
  addChangeComment,
  assignChange,
  completeChange,
  createChange,
  decideChange,
  deleteChange,
  getChange,
  implementChange,
  listChangeComments,
  listChanges,
  rollbackChange,
  updateChange,
} from '../../services/itsm/changes.service';
import type {
  AssignChangeInput,
  CompleteChangeInput,
  DecideChangeInput,
  ImplementChangeInput,
  RollbackChangeInput,
} from '../../validators/itsm/changes.validators';

const base = makeTicketController(
  {
    list: listChanges,
    get: getChange,
    create: createChange,
    update: updateChange,
    remove: deleteChange,
    listComments: listChangeComments,
    addComment: addChangeComment,
  },
  'changeId',
);

export const changeController = {
  ...base,

  assign: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await assignChange(actor.tenantId, req.params.changeId!, req.body as AssignChangeInput, actor));
  }),

  decide: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await decideChange(actor.tenantId, req.params.changeId!, req.body as DecideChangeInput, actor));
  }),

  implement: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await implementChange(actor.tenantId, req.params.changeId!, req.body as ImplementChangeInput, actor));
  }),

  complete: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await completeChange(actor.tenantId, req.params.changeId!, req.body as CompleteChangeInput, actor));
  }),

  rollback: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await rollbackChange(actor.tenantId, req.params.changeId!, req.body as RollbackChangeInput, actor));
  }),
};
