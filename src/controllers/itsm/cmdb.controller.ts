import { makeItsmCrudController } from './crud.controller';
import { ciRelationshipService, configurationItemService } from '../../services/itsm/cmdb.service';

export const configurationItemController = makeItsmCrudController(configurationItemService, 'ciId');
export const ciRelationshipController = makeItsmCrudController(ciRelationshipService, 'relationshipId');
