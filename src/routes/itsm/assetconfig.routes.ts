import { Router } from 'express';
import { registerItsmCrudRoutes } from './crud.routes';
import { assetLicenseController, assetModelController } from '../../controllers/itsm/assetconfig.controller';
import {
  assetLicenseIdParamSchema,
  assetModelIdParamSchema,
  createAssetLicenseSchema,
  createAssetModelSchema,
  updateAssetLicenseSchema,
  updateAssetModelSchema,
} from '../../validators/itsm/assetconfig.validators';

export const assetConfigItsmRouter = Router();

registerItsmCrudRoutes(assetConfigItsmRouter, assetModelController, {
  idParam: 'assetModelId',
  basePath: '/models',
  read: 'asset_configuration.read',
  manage: 'asset_configuration.manage',
  idSchema: assetModelIdParamSchema,
  createSchema: createAssetModelSchema,
  updateSchema: updateAssetModelSchema,
});

registerItsmCrudRoutes(assetConfigItsmRouter, assetLicenseController, {
  idParam: 'assetLicenseId',
  basePath: '/licenses',
  read: 'asset_configuration.read',
  manage: 'asset_configuration.manage',
  idSchema: assetLicenseIdParamSchema,
  createSchema: createAssetLicenseSchema,
  updateSchema: updateAssetLicenseSchema,
});
