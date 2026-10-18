/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Router } from 'express';
import type { ZodType } from 'zod';
import { requireTenantPermission, validateRequest } from '../../api/middleware';

export interface ItsmTransitionSpec {
  path: string;
  action: string;
  status: string;
  code?: string;
  extraKeys?: string[];
  bodySchema?: ZodType;
}

export interface ItsmCrudRouteOptions {
  idParam: string;
  read: string;
  manage: string;
  idSchema: ZodType;
  createSchema?: ZodType;
  updateSchema?: ZodType;
  transitions?: ItsmTransitionSpec[];
  /** Optional resource prefix registered on the mount router, e.g. `/articles`. */
  basePath?: string;
}

export function registerItsmCrudRoutes(
  router: Router,
  controller: any,
  options: ItsmCrudRouteOptions,
): void {
  const prefix = options.basePath ?? '';
  const root = prefix || '/';
  const base = `${prefix}/:${options.idParam}`;

  router.get(root, requireTenantPermission(options.read), controller.list);
  if (options.createSchema) {
    router.post(root, requireTenantPermission(options.manage), validateRequest({ body: options.createSchema }), controller.create);
  }
  router.get(base, requireTenantPermission(options.read), validateRequest({ params: options.idSchema }), controller.get);
  if (options.updateSchema) {
    router.patch(
      base,
      requireTenantPermission(options.manage),
      validateRequest({ params: options.idSchema, body: options.updateSchema }),
      controller.update,
    );
  }
  router.delete(base, requireTenantPermission(options.manage), validateRequest({ params: options.idSchema }), controller.remove);

  for (const transition of options.transitions ?? []) {
    router.post(
      `${base}${transition.path}`,
      requireTenantPermission(transition.code ?? options.manage),
      validateRequest({ params: options.idSchema, ...(transition.bodySchema ? { body: transition.bodySchema } : {}) }),
      controller.transition(transition.action, transition.status, transition.extraKeys ?? []),
    );
  }
}
