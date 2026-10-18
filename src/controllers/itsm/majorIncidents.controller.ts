import { makeItsmCrudController } from './crud.controller';
import { majorIncidentService } from '../../services/itsm/majorIncidents.service';

export const majorIncidentController = makeItsmCrudController(majorIncidentService, 'majorIncidentId');
