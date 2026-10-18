import type { Request, Response } from 'express';
import { ok } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from './actor';
import {
  getOrganizationStructure,
  updateOrganizationStructure,
} from '../../services/tenantadmin/organizationStructure.service';
import type { UpdateOrganizationStructureInput } from '../../validators/tenantadmin/organizationStructure.validators';

export const getOrganizationStructureHandler = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await getOrganizationStructure(tenantActor(req).tenantId));
});

export const updateOrganizationStructureHandler = asyncHandler(async (req: Request, res: Response) => {
  return ok(
    res,
    await updateOrganizationStructure(tenantActor(req), req.body as UpdateOrganizationStructureInput),
  );
});
