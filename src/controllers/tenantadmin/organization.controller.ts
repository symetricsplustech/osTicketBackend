import type { Request, Response } from 'express';
import { ok } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import {
  getOrganization,
  getOrganizationBranding,
  getOrganizationBusinessHours,
  getOrganizationLocalization,
  updateOrganization,
  updateOrganizationBranding,
  updateOrganizationBusinessHours,
  updateOrganizationLocalization,
} from '../../services/tenantadmin/organization.service';
import type {
  UpdateOrganizationBrandingInput,
  UpdateOrganizationBusinessHoursInput,
  UpdateOrganizationInput,
  UpdateOrganizationLocalizationInput,
} from '../../validators/tenantadmin/organization.validators';
import { tenantActor } from './actor';

export const getOrganizationHandler = asyncHandler(async (req: Request, res: Response) => {
  const organization = await getOrganization(tenantActor(req).tenantId);
  return ok(res, organization);
});

export const updateOrganizationHandler = asyncHandler(async (req: Request, res: Response) => {
  const organization = await updateOrganization(tenantActor(req), req.body as UpdateOrganizationInput);
  return ok(res, organization);
});

export const getBrandingHandler = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await getOrganizationBranding(tenantActor(req).tenantId));
});

export const updateBrandingHandler = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await updateOrganizationBranding(tenantActor(req), req.body as UpdateOrganizationBrandingInput));
});

export const getLocalizationHandler = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await getOrganizationLocalization(tenantActor(req).tenantId));
});

export const updateLocalizationHandler = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await updateOrganizationLocalization(tenantActor(req), req.body as UpdateOrganizationLocalizationInput));
});

export const getBusinessHoursHandler = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await getOrganizationBusinessHours(tenantActor(req).tenantId));
});

export const updateBusinessHoursHandler = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await updateOrganizationBusinessHours(tenantActor(req), req.body as UpdateOrganizationBusinessHoursInput));
});
