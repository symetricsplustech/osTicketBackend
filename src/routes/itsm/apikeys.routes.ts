import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { apiKeyController } from '../../controllers/itsm/apikeys.controller';
import {
  apiKeyIdParamSchema,
  createApiKeySchema,
  revokeApiKeySchema,
  updateApiKeySchema,
} from '../../validators/itsm/apikeys.validators';

export const apiKeysItsmRouter = Router();

apiKeysItsmRouter.get('/', requireTenantPermission('api_keys.read'), apiKeyController.list);
apiKeysItsmRouter.post(
  '/',
  requireTenantPermission('api_keys.manage'),
  validateRequest({ body: createApiKeySchema }),
  apiKeyController.create,
);
apiKeysItsmRouter.get(
  '/:apiKeyId',
  requireTenantPermission('api_keys.read'),
  validateRequest({ params: apiKeyIdParamSchema }),
  apiKeyController.get,
);
apiKeysItsmRouter.patch(
  '/:apiKeyId',
  requireTenantPermission('api_keys.manage'),
  validateRequest({ params: apiKeyIdParamSchema, body: updateApiKeySchema }),
  apiKeyController.update,
);
apiKeysItsmRouter.post(
  '/:apiKeyId/revoke',
  requireTenantPermission('api_keys.manage'),
  validateRequest({ params: apiKeyIdParamSchema, body: revokeApiKeySchema }),
  apiKeyController.revoke,
);
apiKeysItsmRouter.post(
  '/:apiKeyId/rotate',
  requireTenantPermission('api_keys.manage'),
  validateRequest({ params: apiKeyIdParamSchema }),
  apiKeyController.rotate,
);
apiKeysItsmRouter.get(
  '/:apiKeyId/usage',
  requireTenantPermission('api_keys.read'),
  validateRequest({ params: apiKeyIdParamSchema }),
  apiKeyController.listUsage,
);
