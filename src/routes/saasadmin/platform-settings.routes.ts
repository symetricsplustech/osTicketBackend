import { Router } from 'express';
import * as platformSettingsController from '../../controllers/saasadmin/platform-settings.controller';
import { authorize, validateRequest } from '../../api/middleware';
import {
  featureFlagKeyParamSchema,
  settingKeyParamSchema,
  updateBrandingSchema,
  updateFeatureFlagSchema,
  updateLocalizationSchema,
  updateRetentionSchema,
  updateSecuritySchema,
  updateSettingSchema,
} from '../../validators/saasadmin/platform-settings.validators';

export const platformSettingsAdminRouter = Router();

platformSettingsAdminRouter.get('/', authorize('admin.settings.read'), platformSettingsController.list);
platformSettingsAdminRouter.get('/groups', authorize('admin.settings.read'), platformSettingsController.groups);

platformSettingsAdminRouter.get('/branding', authorize('admin.settings.read'), platformSettingsController.branding);
platformSettingsAdminRouter.patch(
  '/branding',
  authorize('admin.settings.manage'),
  validateRequest({ body: updateBrandingSchema }),
  platformSettingsController.patchBranding,
);

platformSettingsAdminRouter.get('/localization', authorize('admin.settings.read'), platformSettingsController.localization);
platformSettingsAdminRouter.patch(
  '/localization',
  authorize('admin.settings.manage'),
  validateRequest({ body: updateLocalizationSchema }),
  platformSettingsController.patchLocalization,
);

platformSettingsAdminRouter.get('/security', authorize('admin.settings.read'), platformSettingsController.security);
platformSettingsAdminRouter.patch(
  '/security',
  authorize('admin.settings.manage'),
  validateRequest({ body: updateSecuritySchema }),
  platformSettingsController.patchSecurity,
);

platformSettingsAdminRouter.get('/retention', authorize('admin.settings.read'), platformSettingsController.retention);
platformSettingsAdminRouter.patch(
  '/retention',
  authorize('admin.settings.manage'),
  validateRequest({ body: updateRetentionSchema }),
  platformSettingsController.patchRetention,
);

platformSettingsAdminRouter.get('/feature-flags', authorize('admin.settings.read'), platformSettingsController.featureFlags);
platformSettingsAdminRouter.patch(
  '/feature-flags/:flagKey',
  authorize('admin.settings.manage'),
  validateRequest({ params: featureFlagKeyParamSchema, body: updateFeatureFlagSchema }),
  platformSettingsController.patchFeatureFlag,
);

platformSettingsAdminRouter.get(
  '/:key',
  authorize('admin.settings.read'),
  validateRequest({ params: settingKeyParamSchema }),
  platformSettingsController.getByKey,
);
platformSettingsAdminRouter.patch(
  '/:key',
  authorize('admin.settings.manage'),
  validateRequest({ params: settingKeyParamSchema, body: updateSettingSchema }),
  platformSettingsController.patchByKey,
);
