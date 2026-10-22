import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { registerItsmCrudRoutes } from "./crud.routes";
import { accessReviewController } from "../../controllers/itsm/governance.controller";
import {
  accessReviewIdParamSchema,
  accessReviewItemIdParamSchema,
  createAccessReviewItemSchema,
  createAccessReviewSchema,
  decideAccessReviewItemSchema,
  updateAccessReviewSchema,
} from "../../validators/itsm/governance.validators";

export const accessReviewsItsmRouter = Router();

registerItsmCrudRoutes(accessReviewsItsmRouter, accessReviewController, {
  idParam: "reviewId",
  read: "access_reviews.read",
  manage: "access_reviews.manage",
  idSchema: accessReviewIdParamSchema,
  createSchema: createAccessReviewSchema,
  updateSchema: updateAccessReviewSchema,
});

accessReviewsItsmRouter.post(
  "/:reviewId/start",
  requireTenantPermission("access_reviews.manage"),
  validateRequest({ params: accessReviewIdParamSchema }),
  accessReviewController.start,
);

accessReviewsItsmRouter.post(
  "/:reviewId/complete",
  requireTenantPermission("access_reviews.manage"),
  validateRequest({ params: accessReviewIdParamSchema }),
  accessReviewController.complete,
);

accessReviewsItsmRouter.post(
  "/:reviewId/cancel",
  requireTenantPermission("access_reviews.manage"),
  validateRequest({ params: accessReviewIdParamSchema }),
  accessReviewController.cancel,
);

accessReviewsItsmRouter.get(
  "/:reviewId/items",
  requireTenantPermission("access_reviews.read"),
  validateRequest({ params: accessReviewIdParamSchema }),
  accessReviewController.listItems,
);

accessReviewsItsmRouter.post(
  "/:reviewId/items",
  requireTenantPermission("access_reviews.manage"),
  validateRequest({
    params: accessReviewIdParamSchema,
    body: createAccessReviewItemSchema,
  }),
  accessReviewController.addItem,
);

accessReviewsItsmRouter.post(
  "/:reviewId/items/:itemId/decide",
  requireTenantPermission("access_reviews.manage"),
  validateRequest({
    params: accessReviewIdParamSchema.merge(accessReviewItemIdParamSchema),
    body: decideAccessReviewItemSchema,
  }),
  accessReviewController.decideItem,
);

accessReviewsItsmRouter.delete(
  "/:reviewId/items/:itemId",
  requireTenantPermission("access_reviews.manage"),
  validateRequest({
    params: accessReviewIdParamSchema.merge(accessReviewItemIdParamSchema),
  }),
  accessReviewController.removeItem,
);
