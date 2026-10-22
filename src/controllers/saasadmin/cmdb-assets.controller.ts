import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  createAssetCategory,
  createCiType,
  createDiscoveryProfile,
  createRelationshipType,
  getCiType,
  getTenantCmdbConfiguration,
  listAssetCategories,
  listCiTypes,
  listDiscoveryProfiles,
  listRelationshipTypes,
  updateAssetCategory,
  updateCiType,
  updateDiscoveryProfile,
  updateRelationshipType,
  updateTenantCmdbConfiguration,
} from "../../services/saasadmin/cmdb-assets.service";
import type {
  CreateAssetCategoryInput,
  CreateCiRelationshipTypeInput,
  CreateCiTypeInput,
  CreateDiscoveryProfileInput,
  UpdateAssetCategoryInput,
  UpdateCiRelationshipTypeInput,
  UpdateCiTypeInput,
  UpdateDiscoveryProfileInput,
  UpdateTenantCmdbConfigurationInput,
} from "../../validators/saasadmin/cmdb-assets.validators";

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listCiTypesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listCiTypes(req);
    return paginated(res, rows, meta);
  },
);

export const createCiTypeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const ciType = await createCiType(
      req.body as CreateCiTypeInput,
      actorOf(req),
    );
    return created(res, ciType);
  },
);

export const getCiTypeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const ciType = await getCiType(req.params.typeId);
    return ok(res, ciType);
  },
);

export const updateCiTypeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const ciType = await updateCiType(
      req.params.typeId,
      req.body as UpdateCiTypeInput,
      actorOf(req),
    );
    return ok(res, ciType);
  },
);

export const listRelationshipTypesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listRelationshipTypes(req);
    return paginated(res, rows, meta);
  },
);

export const createRelationshipTypeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const relationshipType = await createRelationshipType(
      req.body as CreateCiRelationshipTypeInput,
      actorOf(req),
    );
    return created(res, relationshipType);
  },
);

export const updateRelationshipTypeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const relationshipType = await updateRelationshipType(
      req.params.relationshipTypeId,
      req.body as UpdateCiRelationshipTypeInput,
      actorOf(req),
    );
    return ok(res, relationshipType);
  },
);

export const listAssetCategoriesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listAssetCategories(req);
    return paginated(res, rows, meta);
  },
);

export const createAssetCategoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await createAssetCategory(
      req.body as CreateAssetCategoryInput,
      actorOf(req),
    );
    return created(res, category);
  },
);

export const updateAssetCategoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await updateAssetCategory(
      req.params.categoryId,
      req.body as UpdateAssetCategoryInput,
      actorOf(req),
    );
    return ok(res, category);
  },
);

export const listDiscoveryProfilesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listDiscoveryProfiles(req);
    return paginated(res, rows, meta);
  },
);

export const createDiscoveryProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const profile = await createDiscoveryProfile(
      req.body as CreateDiscoveryProfileInput,
      actorOf(req),
    );
    return created(res, profile);
  },
);

export const updateDiscoveryProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const profile = await updateDiscoveryProfile(
      req.params.profileId,
      req.body as UpdateDiscoveryProfileInput,
      actorOf(req),
    );
    return ok(res, profile);
  },
);

export const getTenantConfigurationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const configuration = await getTenantCmdbConfiguration(req.params.tenantId);
    return ok(res, configuration);
  },
);

export const updateTenantConfigurationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { settings } = req.body as UpdateTenantCmdbConfigurationInput;
    const record = await updateTenantCmdbConfiguration(
      req.params.tenantId,
      settings,
      actorOf(req),
    );
    return ok(res, record, { message: "Tenant CMDB configuration updated." });
  },
);
