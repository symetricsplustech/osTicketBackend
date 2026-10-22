import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { makeStructureController } from "../tenantadmin/structure.controller";
import {
  catalogCategoryService,
  createCatalogItem,
  deleteCatalogItem,
  getCatalogItem,
  listCatalogItemVersions,
  listCatalogItems,
  publishCatalogItem,
  retireCatalogItem,
  updateCatalogItem,
} from "../../services/itsm/catalog.service";
import type {
  CreateCatalogItemInput,
  UpdateCatalogItemInput,
} from "../../validators/itsm/catalog.validators";

const categoryBase = makeStructureController(
  catalogCategoryService,
  "categoryId",
);

export const catalogController = {
  listCategories: categoryBase.list,
  getCategory: categoryBase.get,
  createCategory: categoryBase.create,
  updateCategory: categoryBase.update,
  removeCategory: categoryBase.remove,

  listItems: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await listCatalogItems(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),

  getItem: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await getCatalogItem(actor.tenantId, req.params.itemId!));
  }),

  createItem: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await createCatalogItem(
        actor.tenantId,
        req.body as CreateCatalogItemInput,
        actor,
      ),
    );
  }),

  updateItem: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await updateCatalogItem(
        actor.tenantId,
        req.params.itemId!,
        req.body as UpdateCatalogItemInput,
        actor,
      ),
    );
  }),

  removeItem: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    await deleteCatalogItem(actor.tenantId, req.params.itemId!, actor);
    return ok(res, { itemId: req.params.itemId, deleted: true });
  }),

  publishItem: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await publishCatalogItem(actor.tenantId, req.params.itemId!, actor),
    );
  }),

  retireItem: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await retireCatalogItem(actor.tenantId, req.params.itemId!, actor),
    );
  }),

  listItemVersions: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await listCatalogItemVersions(
      actor.tenantId,
      req.params.itemId!,
      req,
    );
    return paginated(res, rows, meta);
  }),
};
