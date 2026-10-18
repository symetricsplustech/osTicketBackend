import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { exportController } from '../../controllers/itsm/exports.controller';
import { exportJobIdParamSchema, runExportSchema } from '../../validators/itsm/exports.validators';

export const exportsItsmRouter = Router();

exportsItsmRouter.get('/', requireTenantPermission('exports.read'), exportController.list);
exportsItsmRouter.post(
  '/',
  requireTenantPermission('exports.manage'),
  validateRequest({ body: runExportSchema }),
  exportController.run,
);
exportsItsmRouter.get(
  '/:jobId',
  requireTenantPermission('exports.read'),
  validateRequest({ params: exportJobIdParamSchema }),
  exportController.get,
);
exportsItsmRouter.post(
  '/:jobId/cancel',
  requireTenantPermission('exports.manage'),
  validateRequest({ params: exportJobIdParamSchema }),
  exportController.cancel,
);
