/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";

export interface ItsmCrudServiceLike {
  list(tenantId: string, req: Request): Promise<{ rows: unknown[]; meta: any }>;
  get(tenantId: string, id: string): Promise<unknown>;
  create(
    tenantId: string,
    input: Record<string, unknown>,
    actor: any,
  ): Promise<unknown>;
  update(
    tenantId: string,
    id: string,
    input: Record<string, unknown>,
    actor: any,
  ): Promise<unknown>;
  remove(tenantId: string, id: string, actor: any): Promise<void>;
  transition(
    tenantId: string,
    id: string,
    actor: any,
    action: string,
    targetStatus: string,
    extra?: Record<string, unknown>,
  ): Promise<unknown>;
}

const pick = (req: Request, keys: string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of keys)
    if (req.body?.[key] !== undefined) out[key] = req.body[key];
  return out;
};

export function makeItsmCrudController(
  service: ItsmCrudServiceLike,
  idParam: string,
) {
  return {
    list: asyncHandler(async (req: Request, res: Response) => {
      const actor = tenantActor(req);
      const { rows, meta } = await service.list(actor.tenantId, req);
      return paginated(res, rows, meta);
    }),
    get: asyncHandler(async (req: Request, res: Response) => {
      const actor = tenantActor(req);
      return ok(res, await service.get(actor.tenantId, req.params[idParam]!));
    }),
    create: asyncHandler(async (req: Request, res: Response) => {
      const actor = tenantActor(req);
      return created(
        res,
        await service.create(actor.tenantId, req.body ?? {}, actor),
      );
    }),
    update: asyncHandler(async (req: Request, res: Response) => {
      const actor = tenantActor(req);
      return ok(
        res,
        await service.update(
          actor.tenantId,
          req.params[idParam]!,
          req.body ?? {},
          actor,
        ),
      );
    }),
    remove: asyncHandler(async (req: Request, res: Response) => {
      const actor = tenantActor(req);
      await service.remove(actor.tenantId, req.params[idParam]!, actor);
      return ok(res, { [idParam]: req.params[idParam], deleted: true });
    }),
    transition: (
      action: string,
      targetStatus: string,
      extraKeys: string[] = [],
    ) =>
      asyncHandler(async (req: Request, res: Response) => {
        const actor = tenantActor(req);
        const extra = pick(req, extraKeys);
        return ok(
          res,
          await service.transition(
            actor.tenantId,
            req.params[idParam]!,
            actor,
            action,
            targetStatus,
            extra,
          ),
        );
      }),
  };
}
