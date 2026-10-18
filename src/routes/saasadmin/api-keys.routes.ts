import { Router } from 'express';
import * as apiKeysController from '../../controllers/saasadmin/api-keys.controller';
import { authorize, validateRequest } from '../../api/middleware';
import {
  apiKeyIdParamSchema,
  createApiKeySchema,
  revokeApiKeySchema,
  updateApiKeySchema,
} from '../../validators/saasadmin/api-keys.validators';

export const apiKeysAdminRouter = Router();

apiKeysAdminRouter.get('/', authorize('admin.api-keys.read'), apiKeysController.listApiKeysHandler);
apiKeysAdminRouter.post(
  '/',
  authorize('admin.api-keys.manage'),
  validateRequest({ body: createApiKeySchema }),
  apiKeysController.createApiKeyHandler,
);
apiKeysAdminRouter.get(
  '/:keyId',
  authorize('admin.api-keys.read'),
  validateRequest({ params: apiKeyIdParamSchema }),
  apiKeysController.getApiKeyHandler,
);
apiKeysAdminRouter.patch(
  '/:keyId',
  authorize('admin.api-keys.manage'),
  validateRequest({ params: apiKeyIdParamSchema, body: updateApiKeySchema }),
  apiKeysController.updateApiKeyHandler,
);
apiKeysAdminRouter.post(
  '/:keyId/rotate',
  authorize('admin.api-keys.manage'),
  validateRequest({ params: apiKeyIdParamSchema }),
  apiKeysController.rotateApiKeyHandler,
);
apiKeysAdminRouter.post(
  '/:keyId/revoke',
  authorize('admin.api-keys.manage'),
  validateRequest({ params: apiKeyIdParamSchema, body: revokeApiKeySchema }),
  apiKeysController.revokeApiKeyHandler,
);
apiKeysAdminRouter.get(
  '/:keyId/usage',
  authorize('admin.api-keys.read'),
  validateRequest({ params: apiKeyIdParamSchema }),
  apiKeysController.getApiKeyUsageHandler,
);
