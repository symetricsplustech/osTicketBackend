import { Router } from 'express';
import { catalogController } from '../../controllers/itsm/catalog.controller';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import {
  catalogCategoryIdParamSchema,
  catalogItemIdParamSchema,
  createCatalogCategorySchema,
  createCatalogItemSchema,
  updateCatalogCategorySchema,
  updateCatalogItemSchema,
} from '../../validators/itsm/catalog.validators';

export const catalogItsmRouter = Router();

// Categories
catalogItsmRouter.get('/categories', requireTenantPermission('catalog.read'), catalogController.listCategories);
catalogItsmRouter.post(
  '/categories',
  requireTenantPermission('catalog.manage'),
  validateRequest({ body: createCatalogCategorySchema }),
  catalogController.createCategory,
);
catalogItsmRouter.get(
  '/categories/:categoryId',
  requireTenantPermission('catalog.read'),
  validateRequest({ params: catalogCategoryIdParamSchema }),
  catalogController.getCategory,
);
catalogItsmRouter.patch(
  '/categories/:categoryId',
  requireTenantPermission('catalog.manage'),
  validateRequest({ params: catalogCategoryIdParamSchema, body: updateCatalogCategorySchema }),
  catalogController.updateCategory,
);
catalogItsmRouter.delete(
  '/categories/:categoryId',
  requireTenantPermission('catalog.manage'),
  validateRequest({ params: catalogCategoryIdParamSchema }),
  catalogController.removeCategory,
);

// Items
catalogItsmRouter.get('/items', requireTenantPermission('catalog.read'), catalogController.listItems);
catalogItsmRouter.post(
  '/items',
  requireTenantPermission('catalog.manage'),
  validateRequest({ body: createCatalogItemSchema }),
  catalogController.createItem,
);
catalogItsmRouter.get(
  '/items/:itemId',
  requireTenantPermission('catalog.read'),
  validateRequest({ params: catalogItemIdParamSchema }),
  catalogController.getItem,
);
catalogItsmRouter.patch(
  '/items/:itemId',
  requireTenantPermission('catalog.manage'),
  validateRequest({ params: catalogItemIdParamSchema, body: updateCatalogItemSchema }),
  catalogController.updateItem,
);
catalogItsmRouter.delete(
  '/items/:itemId',
  requireTenantPermission('catalog.manage'),
  validateRequest({ params: catalogItemIdParamSchema }),
  catalogController.removeItem,
);
catalogItsmRouter.post(
  '/items/:itemId/publish',
  requireTenantPermission('catalog.publish'),
  validateRequest({ params: catalogItemIdParamSchema }),
  catalogController.publishItem,
);
catalogItsmRouter.post(
  '/items/:itemId/retire',
  requireTenantPermission('catalog.publish'),
  validateRequest({ params: catalogItemIdParamSchema }),
  catalogController.retireItem,
);
catalogItsmRouter.get(
  '/items/:itemId/versions',
  requireTenantPermission('catalog.read'),
  validateRequest({ params: catalogItemIdParamSchema }),
  catalogController.listItemVersions,
);
