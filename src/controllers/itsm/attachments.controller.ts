import { makeItsmCrudController } from './crud.controller';
import { attachmentService } from '../../services/itsm/attachments.service';

export const attachmentController = makeItsmCrudController(attachmentService, 'attachmentId');
