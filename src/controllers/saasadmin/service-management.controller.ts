import type { Request, Response } from 'express';
import { created, noContent, ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import {
  createCategory,
  createService,
  createTemplate,
  deleteCategory,
  getService,
  getTemplate,
  listCategories,
  listServices,
  listTemplates,
  listTemplateVersions,
  publishTemplate,
  replaceTenantServices,
  setServiceStatus,
  updateCategory,
  updateService,
  updateTemplate,
} from '../../services/saasadmin/service-management.service';
import type {
  CreateServiceCategoryInput,
  CreateServiceDefinitionInput,
  CreateServiceTemplateInput,
  TenantServicesAssignmentInput,
  UpdateServiceCategoryInput,
  UpdateServiceDefinitionInput,
  UpdateServiceTemplateInput,
} from '../../validators/saasadmin/service-management.validators';

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listServicesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listServices(req);
  return paginated(res, rows, meta);
});

export const createServiceHandler = asyncHandler(async (req: Request, res: Response) => {
  const service = await createService(req.body as CreateServiceDefinitionInput, actorOf(req));
  return created(res, service);
});

export const getServiceHandler = asyncHandler(async (req: Request, res: Response) => {
  const service = await getService(req.params.serviceId);
  return ok(res, service);
});

export const updateServiceHandler = asyncHandler(async (req: Request, res: Response) => {
  const service = await updateService(req.params.serviceId, req.body as UpdateServiceDefinitionInput, actorOf(req));
  return ok(res, service);
});

export const enableServiceHandler = asyncHandler(async (req: Request, res: Response) => {
  const service = await setServiceStatus(req.params.serviceId, 'ENABLED', actorOf(req));
  return ok(res, service, { message: 'Service enabled.' });
});

export const disableServiceHandler = asyncHandler(async (req: Request, res: Response) => {
  const service = await setServiceStatus(req.params.serviceId, 'DISABLED', actorOf(req));
  return ok(res, service, { message: 'Service disabled.' });
});

export const listCategoriesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listCategories(req);
  return paginated(res, rows, meta);
});

export const createCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const category = await createCategory(req.body as CreateServiceCategoryInput, actorOf(req));
  return created(res, category);
});

export const updateCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const category = await updateCategory(req.params.categoryId, req.body as UpdateServiceCategoryInput, actorOf(req));
  return ok(res, category);
});

export const deleteCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  await deleteCategory(req.params.categoryId, actorOf(req));
  return noContent(res);
});

export const listTemplatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listTemplates(req);
  return paginated(res, rows, meta);
});

export const createTemplateHandler = asyncHandler(async (req: Request, res: Response) => {
  const template = await createTemplate(req.body as CreateServiceTemplateInput, actorOf(req));
  return created(res, template);
});

export const getTemplateHandler = asyncHandler(async (req: Request, res: Response) => {
  const template = await getTemplate(req.params.templateId);
  return ok(res, template);
});

export const updateTemplateHandler = asyncHandler(async (req: Request, res: Response) => {
  const template = await updateTemplate(req.params.templateId, req.body as UpdateServiceTemplateInput, actorOf(req));
  return ok(res, template);
});

export const publishTemplateHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await publishTemplate(req.params.templateId, actorOf(req));
  return created(res, result, { message: 'Template published.' });
});

export const listTemplateVersionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listTemplateVersions(req.params.templateId, req);
  return paginated(res, rows, meta);
});

export const replaceTenantServicesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { serviceIds } = req.body as TenantServicesAssignmentInput;
  const assignments = await replaceTenantServices(req.params.tenantId, serviceIds, actorOf(req));
  return ok(res, assignments);
});
