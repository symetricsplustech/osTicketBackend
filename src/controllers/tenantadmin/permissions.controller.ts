import type { Request, Response } from 'express';
import { ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { getPermission, getPermissionGroups, listPermissions } from '../../services/tenantadmin/permissions.service';

export const listPermissionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listPermissions(req);
  return paginated(res, rows, meta);
});

export const permissionGroups = asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, await getPermissionGroups());
});

export const getPermissionHandler = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await getPermission(req.params.permissionId!));
});
