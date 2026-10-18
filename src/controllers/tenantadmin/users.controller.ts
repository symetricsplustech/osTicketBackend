import type { Request, Response } from 'express';
import { created, ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from './actor';
import {
  activateUser,
  deactivateUser,
  getUser,
  getUserRoles,
  inviteUser,
  listInvitations,
  listUserActivity,
  listUsers,
  resetUserPassword,
  revokeInvitation,
  revokeUserSessions,
  setUserRoles,
  suspendUser,
  updateUser,
} from '../../services/tenantadmin/users.service';
import type {
  InviteTenantUserInput,
  SetTenantUserRolesInput,
  TenantUserStatusReasonInput,
  UpdateTenantUserInput,
} from '../../validators/tenantadmin/users.validators';

export const listUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  const { rows, meta } = await listUsers(actor.tenantId, req);
  return paginated(res, rows, meta);
});

export const inviteUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  const result = await inviteUser(actor.tenantId, req.body as InviteTenantUserInput, actor);
  return created(res, result);
});

export const getUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  return ok(res, await getUser(actor.tenantId, req.params.userId!));
});

export const updateUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  return ok(res, await updateUser(actor.tenantId, req.params.userId!, req.body as UpdateTenantUserInput, actor));
});

export const activateUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  return ok(res, await activateUser(actor.tenantId, req.params.userId!, actor));
});

export const suspendUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  const { reason } = (req.body ?? {}) as TenantUserStatusReasonInput;
  return ok(res, await suspendUser(actor.tenantId, req.params.userId!, actor, reason));
});

export const deactivateUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  const { reason } = (req.body ?? {}) as TenantUserStatusReasonInput;
  return ok(res, await deactivateUser(actor.tenantId, req.params.userId!, actor, reason));
});

export const resetUserPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  return ok(res, await resetUserPassword(actor.tenantId, req.params.userId!, actor));
});

export const revokeUserSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  return ok(res, await revokeUserSessions(actor.tenantId, req.params.userId!, actor));
});

export const getUserRolesHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  return ok(res, await getUserRoles(actor.tenantId, req.params.userId!));
});

export const setUserRolesHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  return ok(
    res,
    await setUserRoles(actor.tenantId, req.params.userId!, req.body as SetTenantUserRolesInput, actor),
  );
});

export const listUserActivityHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  const { rows, meta } = await listUserActivity(actor.tenantId, req.params.userId!, req);
  return paginated(res, rows, meta);
});

export const listInvitationsHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  const { rows, meta } = await listInvitations(actor.tenantId, req);
  return paginated(res, rows, meta);
});

export const revokeInvitationHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = tenantActor(req);
  return ok(res, await revokeInvitation(actor.tenantId, req.params.invitationId!, actor));
});
