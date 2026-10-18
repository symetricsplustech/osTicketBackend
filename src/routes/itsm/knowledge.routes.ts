import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { registerItsmCrudRoutes } from './crud.routes';
import {
  knowledgeArticleController,
  knowledgeCategoryController,
  knowledgeSettingsController,
} from '../../controllers/itsm/knowledge.controller';
import {
  createKnowledgeArticleSchema,
  createKnowledgeCategorySchema,
  createKnowledgeCommentSchema,
  knowledgeArticleIdParamSchema,
  knowledgeCategoryIdParamSchema,
  updateKnowledgeArticleSchema,
  updateKnowledgeCategorySchema,
  updateKnowledgeSettingsSchema,
} from '../../validators/itsm/knowledge.validators';

export const knowledgeItsmRouter = Router();

knowledgeItsmRouter.get(
  '/settings',
  requireTenantPermission('knowledge.read'),
  knowledgeSettingsController.get,
);
knowledgeItsmRouter.put(
  '/settings',
  requireTenantPermission('knowledge.settings.manage'),
  validateRequest({ body: updateKnowledgeSettingsSchema }),
  knowledgeSettingsController.update,
);

registerItsmCrudRoutes(knowledgeItsmRouter, knowledgeCategoryController, {
  idParam: 'categoryId',
  basePath: '/categories',
  read: 'knowledge.read',
  manage: 'knowledge.create',
  idSchema: knowledgeCategoryIdParamSchema,
  createSchema: createKnowledgeCategorySchema,
  updateSchema: updateKnowledgeCategorySchema,
});

registerItsmCrudRoutes(knowledgeItsmRouter, knowledgeArticleController, {
  idParam: 'articleId',
  basePath: '/articles',
  read: 'knowledge.read',
  manage: 'knowledge.create',
  idSchema: knowledgeArticleIdParamSchema,
  createSchema: createKnowledgeArticleSchema,
  updateSchema: updateKnowledgeArticleSchema,
});
knowledgeItsmRouter.get(
  '/articles/:articleId/comments',
  requireTenantPermission('knowledge.read'),
  validateRequest({ params: knowledgeArticleIdParamSchema }),
  knowledgeArticleController.listComments,
);
knowledgeItsmRouter.post(
  '/articles/:articleId/comments',
  requireTenantPermission('knowledge.create'),
  validateRequest({ params: knowledgeArticleIdParamSchema, body: createKnowledgeCommentSchema }),
  knowledgeArticleController.addComment,
);
knowledgeItsmRouter.post(
  '/articles/:articleId/submit',
  requireTenantPermission('knowledge.review'),
  validateRequest({ params: knowledgeArticleIdParamSchema }),
  knowledgeArticleController.submitReview,
);
knowledgeItsmRouter.post(
  '/articles/:articleId/publish',
  requireTenantPermission('knowledge.publish'),
  validateRequest({ params: knowledgeArticleIdParamSchema }),
  knowledgeArticleController.publish,
);
knowledgeItsmRouter.post(
  '/articles/:articleId/archive',
  requireTenantPermission('knowledge.publish'),
  validateRequest({ params: knowledgeArticleIdParamSchema }),
  knowledgeArticleController.archive,
);
