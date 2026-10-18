import { makeItsmCrudController } from './crud.controller';
import { releaseService } from '../../services/itsm/releases.service';

export const releaseController = makeItsmCrudController(releaseService, 'releaseId');
