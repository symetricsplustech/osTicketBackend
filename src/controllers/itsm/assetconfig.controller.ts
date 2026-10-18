import { makeItsmCrudController } from './crud.controller';
import { assetLicenseService, assetModelService } from '../../services/itsm/assetconfig.service';

export const assetModelController = makeItsmCrudController(assetModelService, 'assetModelId');
export const assetLicenseController = makeItsmCrudController(assetLicenseService, 'assetLicenseId');
