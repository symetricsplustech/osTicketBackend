import type { Request, Response } from 'express';
import { created, ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { makeItsmCrudController } from './crud.controller';
import { knowledgeArticleService, knowledgeCategoryService, knowledgeSettingsService } from '../../services/itsm/knowledge.service';

export const knowledgeCategoryController = makeItsmCrudController(knowledgeCategoryService, 'categoryId');

const articleBase = makeItsmCrudController(knowledgeArticleService, 'articleId');

export const knowledgeArticleController = {
  ...articleBase,
  listComments: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await knowledgeArticleService.listComments(actor.tenantId, req.params.articleId!, req);
    return paginated(res, rows, meta);
  }),
  addComment: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(res, await knowledgeArticleService.addComment(actor.tenantId, req.params.articleId!, req.body, actor));
  }),
  publish: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await knowledgeArticleService.transition(actor.tenantId, req.params.articleId!, actor, 'published', 'PUBLISHED'));
  }),
  archive: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await knowledgeArticleService.transition(actor.tenantId, req.params.articleId!, actor, 'archived', 'ARCHIVED'));
  }),
  submitReview: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await knowledgeArticleService.transition(actor.tenantId, req.params.articleId!, actor, 'submitted', 'IN_REVIEW', { reviewedAt: null }));
  }),
};

export const knowledgeSettingsController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await knowledgeSettingsService.get(tenantActor(req).tenantId));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await knowledgeSettingsService.update(actor.tenantId, req.body ?? {}, actor));
  }),
};
