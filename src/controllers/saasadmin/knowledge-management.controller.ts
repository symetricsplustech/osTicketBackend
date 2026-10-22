import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  createCategory,
  createPolicy,
  createReviewRule,
  createTemplate,
  getTenantSettings,
  listCategories,
  listPolicies,
  listReviewRules,
  listTemplates,
  updateCategory,
  updatePolicy,
  updateReviewRule,
  updateTemplate,
  updateTenantSettings,
} from "../../services/saasadmin/knowledge-management.service";
import type {
  CreateKnowledgeCategoryInput,
  CreateKnowledgePolicyInput,
  CreateKnowledgeReviewRuleInput,
  CreateKnowledgeTemplateInput,
  UpdateKnowledgeCategoryInput,
  UpdateKnowledgePolicyInput,
  UpdateKnowledgeReviewRuleInput,
  UpdateKnowledgeTemplateInput,
  UpdateKnowledgeTenantSettingsInput,
} from "../../validators/saasadmin/knowledge-management.validators";

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listPoliciesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listPolicies(req);
    return paginated(res, rows, meta);
  },
);

export const createPolicyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const policy = await createPolicy(
      req.body as CreateKnowledgePolicyInput,
      actorOf(req),
    );
    return created(res, policy);
  },
);

export const updatePolicyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const policy = await updatePolicy(
      req.params.policyId,
      req.body as UpdateKnowledgePolicyInput,
      actorOf(req),
    );
    return ok(res, policy);
  },
);

export const listCategoriesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listCategories(req);
    return paginated(res, rows, meta);
  },
);

export const createCategoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await createCategory(
      req.body as CreateKnowledgeCategoryInput,
      actorOf(req),
    );
    return created(res, category);
  },
);

export const updateCategoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await updateCategory(
      req.params.categoryId,
      req.body as UpdateKnowledgeCategoryInput,
      actorOf(req),
    );
    return ok(res, category);
  },
);

export const listTemplatesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listTemplates(req);
    return paginated(res, rows, meta);
  },
);

export const createTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const template = await createTemplate(
      req.body as CreateKnowledgeTemplateInput,
      actorOf(req),
    );
    return created(res, template);
  },
);

export const updateTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const template = await updateTemplate(
      req.params.templateId,
      req.body as UpdateKnowledgeTemplateInput,
      actorOf(req),
    );
    return ok(res, template);
  },
);

export const listReviewRulesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listReviewRules(req);
    return paginated(res, rows, meta);
  },
);

export const createReviewRuleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const rule = await createReviewRule(
      req.body as CreateKnowledgeReviewRuleInput,
      actorOf(req),
    );
    return created(res, rule);
  },
);

export const updateReviewRuleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const rule = await updateReviewRule(
      req.params.ruleId,
      req.body as UpdateKnowledgeReviewRuleInput,
      actorOf(req),
    );
    return ok(res, rule);
  },
);

export const getTenantSettingsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const settings = await getTenantSettings(req.params.tenantId);
    return ok(res, settings);
  },
);

export const updateTenantSettingsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { settings } = req.body as UpdateKnowledgeTenantSettingsInput;
    const record = await updateTenantSettings(
      req.params.tenantId,
      settings,
      actorOf(req),
    );
    return ok(res, record, { message: "Tenant knowledge settings updated." });
  },
);
