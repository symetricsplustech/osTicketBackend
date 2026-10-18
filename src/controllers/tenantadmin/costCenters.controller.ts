import { makeStructureController } from './structure.controller';
import { costCenterService } from '../../services/tenantadmin/costCenters.service';

export const costCenterController = makeStructureController(costCenterService, 'costCenterId');
