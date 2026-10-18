import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { attachmentController } from '../../controllers/itsm/attachments.controller';
import { attachmentIdParamSchema, createAttachmentSchema } from '../../validators/itsm/attachments.validators';

export const attachmentsItsmRouter = Router();

attachmentsItsmRouter.get('/', requireTenantPermission('attachments.read'), attachmentController.list);
attachmentsItsmRouter.post(
  '/',
  requireTenantPermission('attachments.upload'),
  validateRequest({ body: createAttachmentSchema }),
  attachmentController.create,
);
attachmentsItsmRouter.get(
  '/:attachmentId',
  requireTenantPermission('attachments.read'),
  validateRequest({ params: attachmentIdParamSchema }),
  attachmentController.get,
);
attachmentsItsmRouter.delete(
  '/:attachmentId',
  requireTenantPermission('attachments.delete'),
  validateRequest({ params: attachmentIdParamSchema }),
  attachmentController.remove,
);
