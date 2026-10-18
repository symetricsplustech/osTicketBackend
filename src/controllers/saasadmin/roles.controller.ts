import type { Request, Response } from 'express';
import { created, noContent, ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import {
  createRole,
  deleteRole,
  getPermissionCatalog,
  getRole,
  getRolePermissions,
  listRoleMembers,
  listRoles,
  setRolePermissions,
  updateRole,
} from '../../services/saasadmin/roles.service';
import type {
  CreateRoleInput,
  SetRolePermissionsInput,
  UpdateRoleInput,
} from '../../validators/saasadmin/roles.validators';

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listRolesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listRoles(req);
  return paginated(res, rows, meta);
});

export const createRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  const role = await createRole(req.body as CreateRoleInput, actorOf(req));
  return created(res, role);
});

export const getRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  const role = await getRole(req.params.roleId!);
  return ok(res, role);
});

export const updateRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  const role = await updateRole(req.params.roleId!, req.body as UpdateRoleInput, actorOf(req));
  return ok(res, role);
});

export const deleteRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  await deleteRole(req.params.roleId!, actorOf(req));
  return noContent(res);
});

export const rolePermissions = asyncHandler(async (req: Request, res: Response) => {
  const permissions = await getRolePermissions(req.params.roleId!);
  return ok(res, permissions);
});

export const setRolePermissionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const permissions = await setRolePermissions(
    req.params.roleId!,
    req.body as SetRolePermissionsInput,
    actorOf(req),
  );
  return ok(res, permissions);
});

export const roleMembers = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listRoleMembers(req.params.roleId!, req);
  return paginated(res, rows, meta);
});

export const permissionCatalog = asyncHandler(async (_req: Request, res: Response) => {
  const groups = getPermissionCatalog();
  return ok(res, groups);
});
