import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  createClassificationCategory,
  createPriority,
  createStatus,
  getItsmModule,
  getTenantItsmConfiguration,
  listClassificationCategories,
  listItsmModules,
  listNumberingRules,
  listPriorities,
  listStatuses,
  updateClassificationCategory,
  updateItsmModule,
  updateNumberingRule,
  updatePriority,
  updateStatus,
  updateTenantItsmConfiguration,
} from "../../services/saasadmin/itsm-configuration.service";
import type {
  CreateClassificationCategoryInput,
  CreatePriorityInput,
  CreateStatusInput,
  UpdateClassificationCategoryInput,
  UpdateItsmModuleInput,
  UpdateNumberingRuleInput,
  UpdatePriorityInput,
  UpdateStatusInput,
  UpdateTenantItsmConfigurationInput,
} from "../../validators/saasadmin/itsm-configuration.validators";

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listModulesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listItsmModules(req);
    return paginated(res, rows, meta);
  },
);

export const getModuleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const module = await getItsmModule(req.params.moduleKey);
    return ok(res, module);
  },
);

export const updateModuleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const module = await updateItsmModule(
      req.params.moduleKey,
      req.body as UpdateItsmModuleInput,
      actorOf(req),
    );
    return ok(res, module);
  },
);

export const listPrioritiesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listPriorities(req);
    return paginated(res, rows, meta);
  },
);

export const createPriorityHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const priority = await createPriority(
      req.body as CreatePriorityInput,
      actorOf(req),
    );
    return created(res, priority);
  },
);

export const updatePriorityHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const priority = await updatePriority(
      req.params.priorityId,
      req.body as UpdatePriorityInput,
      actorOf(req),
    );
    return ok(res, priority);
  },
);

export const listStatusesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listStatuses(req);
    return paginated(res, rows, meta);
  },
);

export const createStatusHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const status = await createStatus(
      req.body as CreateStatusInput,
      actorOf(req),
    );
    return created(res, status);
  },
);

export const updateStatusHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const status = await updateStatus(
      req.params.statusId,
      req.body as UpdateStatusInput,
      actorOf(req),
    );
    return ok(res, status);
  },
);

export const listCategoriesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listClassificationCategories(req);
    return paginated(res, rows, meta);
  },
);

export const createCategoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await createClassificationCategory(
      req.body as CreateClassificationCategoryInput,
      actorOf(req),
    );
    return created(res, category);
  },
);

export const updateCategoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await updateClassificationCategory(
      req.params.categoryId,
      req.body as UpdateClassificationCategoryInput,
      actorOf(req),
    );
    return ok(res, category);
  },
);

export const listNumberingRulesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listNumberingRules(req);
    return paginated(res, rows, meta);
  },
);

export const updateNumberingRuleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const rule = await updateNumberingRule(
      req.params.ruleId,
      req.body as UpdateNumberingRuleInput,
      actorOf(req),
    );
    return ok(res, rule);
  },
);

export const getTenantConfigurationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const configuration = await getTenantItsmConfiguration(req.params.tenantId);
    return ok(res, configuration);
  },
);

export const updateTenantConfigurationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const configuration = await updateTenantItsmConfiguration(
      req.params.tenantId,
      req.body as UpdateTenantItsmConfigurationInput,
      actorOf(req),
    );
    return ok(res, configuration, {
      message: "Tenant ITSM configuration updated.",
    });
  },
);
