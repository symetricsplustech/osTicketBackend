import { makeItsmCrudController } from './crud.controller';
import { vendorService } from '../../services/itsm/vendors.service';

export const vendorController = makeItsmCrudController(vendorService, 'vendorId');
