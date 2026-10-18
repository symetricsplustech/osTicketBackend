import type { Request, Response } from 'express';
import { ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { getPermission, getPermissionGroups, listPermissions } from '../../services/saasadmin/permissions.service';

export const listPermissionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listPermissions(req);
  return paginated(res, rows, meta);
});

export const permissionGroups = asyncHandler(async (_req: Request, res: Response) => {
  const groups = await getPermissionGroups();
  return ok(res, groups);
});

export const getPermissionHandler = asyncHandler(async (req: Request, res: Response) => {
  const permission = await getPermission(req.params.permissionId!);
  return ok(res, permission);
});
