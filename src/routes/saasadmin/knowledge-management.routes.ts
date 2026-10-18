import { Router } from 'express';
import * as knowledgeManagementController from '../../controllers/saasadmin/knowledge-management.controller';
import { authorize, tenantContext, validateRequest } from '../../api/middleware';
import {
  createKnowledgeCategorySchema,
  createKnowledgePolicySchema,
  createKnowledgeReviewRuleSchema,
  createKnowledgeTemplateSchema,
  knowledgeCategoryIdParamSchema,
  knowledgeReviewRuleIdParamSchema,
  knowledgeTemplateIdParamSchema,
  knowledgeTenantParamSchema,
  policyIdParamSchema,
  updateKnowledgeCategorySchema,
  updateKnowledgePolicySchema,
  updateKnowledgeReviewRuleSchema,
  updateKnowledgeTemplateSchema,
  updateKnowledgeTenantSettingsSchema,
} from '../../validators/saasadmin/knowledge-management.validators';

export const knowledgeManagementAdminRouter = Router();

knowledgeManagementAdminRouter.get(
  '/policies',
  authorize('admin.knowledge-management.read'),
  knowledgeManagementController.listPoliciesHandler,
);
knowledgeManagementAdminRouter.post(
  '/policies',
  authorize('admin.knowledge-management.manage'),
  validateRequest({ body: createKnowledgePolicySchema }),
  knowledgeManagementController.createPolicyHandler,
);
knowledgeManagementAdminRouter.patch(
  '/policies/:policyId',
  authorize('admin.knowledge-management.manage'),
  validateRequest({ params: policyIdParamSchema, body: updateKnowledgePolicySchema }),
  knowledgeManagementController.updatePolicyHandler,
);

knowledgeManagementAdminRouter.get(
  '/categories',
  authorize('admin.knowledge-management.read'),
  knowledgeManagementController.listCategoriesHandler,
);
knowledgeManagementAdminRouter.post(
  '/categories',
  authorize('admin.knowledge-management.manage'),
  validateRequest({ body: createKnowledgeCategorySchema }),
  knowledgeManagementController.createCategoryHandler,
);
knowledgeManagementAdminRouter.patch(
  '/categories/:categoryId',
  authorize('admin.knowledge-management.manage'),
  validateRequest({ params: knowledgeCategoryIdParamSchema, body: updateKnowledgeCategorySchema }),
  knowledgeManagementController.updateCategoryHandler,
);

knowledgeManagementAdminRouter.get(
  '/templates',
  authorize('admin.knowledge-management.read'),
  knowledgeManagementController.listTemplatesHandler,
);
knowledgeManagementAdminRouter.post(
  '/templates',
  authorize('admin.knowledge-management.manage'),
  validateRequest({ body: createKnowledgeTemplateSchema }),
  knowledgeManagementController.createTemplateHandler,
);
knowledgeManagementAdminRouter.patch(
  '/templates/:templateId',
  authorize('admin.knowledge-management.manage'),
  validateRequest({ params: knowledgeTemplateIdParamSchema, body: updateKnowledgeTemplateSchema }),
  knowledgeManagementController.updateTemplateHandler,
);

knowledgeManagementAdminRouter.get(
  '/review-rules',
  authorize('admin.knowledge-management.read'),
  knowledgeManagementController.listReviewRulesHandler,
);
knowledgeManagementAdminRouter.post(
  '/review-rules',
  authorize('admin.knowledge-management.manage'),
  validateRequest({ body: createKnowledgeReviewRuleSchema }),
  knowledgeManagementController.createReviewRuleHandler,
);
knowledgeManagementAdminRouter.patch(
  '/review-rules/:ruleId',
  authorize('admin.knowledge-management.manage'),
  validateRequest({ params: knowledgeReviewRuleIdParamSchema, body: updateKnowledgeReviewRuleSchema }),
  knowledgeManagementController.updateReviewRuleHandler,
);

knowledgeManagementAdminRouter.get(
  '/tenants/:tenantId/settings',
  authorize('admin.knowledge-management.read'),
  validateRequest({ params: knowledgeTenantParamSchema }),
  tenantContext(),
  knowledgeManagementController.getTenantSettingsHandler,
);
knowledgeManagementAdminRouter.patch(
  '/tenants/:tenantId/settings',
  authorize('admin.knowledge-management.manage'),
  validateRequest({ params: knowledgeTenantParamSchema, body: updateKnowledgeTenantSettingsSchema }),
  tenantContext(),
  knowledgeManagementController.updateTenantSettingsHandler,
);
