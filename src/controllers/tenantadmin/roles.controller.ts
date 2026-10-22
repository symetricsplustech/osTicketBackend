import type { Request, Response } from "express";
import { created, noContent, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "./actor";
import {
  addRoleMembers,
  createRole,
  deleteRole,
  getPermissionCatalog,
  getRole,
  getRolePermissions,
  listRoleMembers,
  listRoles,
  removeRoleMember,
  setRolePermissions,
  updateRole,
} from "../../services/tenantadmin/roles.service";
import type {
  AddRoleMembersInput,
  CreateTenantRoleInput,
  SetTenantRolePermissionsInput,
  UpdateTenantRoleInput,
} from "../../validators/tenantadmin/roles.validators";

export const listRolesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listRoles(tenantActor(req).tenantId, req);
    return paginated(res, rows, meta);
  },
);

export const createRoleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const role = await createRole(
      tenantActor(req).tenantId,
      req.body as CreateTenantRoleInput,
      tenantActor(req),
    );
    return created(res, role);
  },
);

export const getRoleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const role = await getRole(tenantActor(req).tenantId, req.params.roleId!);
    return ok(res, role);
  },
);

export const updateRoleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const role = await updateRole(
      tenantActor(req).tenantId,
      req.params.roleId!,
      req.body as UpdateTenantRoleInput,
      tenantActor(req),
    );
    return ok(res, role);
  },
);

export const deleteRoleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteRole(
      tenantActor(req).tenantId,
      req.params.roleId!,
      tenantActor(req),
    );
    return noContent(res);
  },
);

export const rolePermissions = asyncHandler(
  async (req: Request, res: Response) => {
    const permissions = await getRolePermissions(
      tenantActor(req).tenantId,
      req.params.roleId!,
    );
    return ok(res, permissions);
  },
);

export const setRolePermissionsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const permissions = await setRolePermissions(
      tenantActor(req).tenantId,
      req.params.roleId!,
      req.body as SetTenantRolePermissionsInput,
      tenantActor(req),
    );
    return ok(res, permissions);
  },
);

export const roleMembers = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listRoleMembers(
    tenantActor(req).tenantId,
    req.params.roleId!,
    req,
  );
  return paginated(res, rows, meta);
});

export const addRoleMembersHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await addRoleMembers(
        actor.tenantId,
        req.params.roleId!,
        req.body as AddRoleMembersInput,
        actor,
      ),
    );
  },
);

export const removeRoleMemberHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await removeRoleMember(
        actor.tenantId,
        req.params.roleId!,
        req.params.membershipId!,
        actor,
      ),
    );
  },
);

export const permissionCatalog = asyncHandler(
  async (_req: Request, res: Response) => {
    return ok(res, getPermissionCatalog());
  },
);
