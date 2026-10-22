import type { Request, Response } from "express";
import { created, noContent, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor, type TenantActor } from "../tenantadmin/actor";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface TicketService {
  list(
    tenantId: string,
    req: Request,
  ): Promise<{ rows: unknown[]; meta: unknown }>;
  get(tenantId: string, id: string): Promise<unknown>;
  create(tenantId: string, input: any, actor: TenantActor): Promise<unknown>;
  update(
    tenantId: string,
    id: string,
    input: any,
    actor: TenantActor,
  ): Promise<unknown>;
  remove(tenantId: string, id: string, actor: TenantActor): Promise<void>;
  listComments(
    tenantId: string,
    id: string,
    req: Request,
  ): Promise<{ rows: unknown[]; meta: unknown }>;
  addComment(
    tenantId: string,
    id: string,
    input: any,
    actor: TenantActor,
  ): Promise<unknown>;
}

export function makeTicketController(service: TicketService, idParam: string) {
  return {
    list: asyncHandler(async (req: Request, res: Response) => {
      const actor = tenantActor(req);
      const { rows, meta } = await service.list(actor.tenantId, req);
      return paginated(res, rows, meta as never);
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
      return noContent(res);
    }),

    listComments: asyncHandler(async (req: Request, res: Response) => {
      const actor = tenantActor(req);
      const { rows, meta } = await service.listComments(
        actor.tenantId,
        req.params[idParam]!,
        req,
      );
      return paginated(res, rows, meta as never);
    }),

    addComment: asyncHandler(async (req: Request, res: Response) => {
      const actor = tenantActor(req);
      return created(
        res,
        await service.addComment(
          actor.tenantId,
          req.params[idParam]!,
          req.body ?? {},
          actor,
        ),
      );
    }),
  };
}
