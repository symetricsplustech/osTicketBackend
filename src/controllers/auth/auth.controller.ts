import type { Request, Response } from "express";
import { ok, created, noContent } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors";
import * as authService from "../../services/auth/auth.service";
import {
  rotateRefreshToken,
  revokeSession,
  setSessionActiveTenant,
} from "../../services/auth/session.service";
import { acceptInvitation } from "../../services/auth/password.service";
import {
  loadAuthorization,
  signAccessToken,
} from "../../api/middleware/authenticate";
import {
  listTenantMemberships,
  resolveTenantAccess,
} from "../../services/auth/tenant-access.service";
import type {
  LoginInput,
  RefreshInput,
  InvitationAcceptInput,
  SwitchTenantInput,
} from "../../validators/auth/auth.validators";

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;
  const result = await authService.login(email, password, req);
  if (result.mfaRequired) {
    return ok(res, { mfaRequired: true, mfaToken: result.mfaToken });
  }
  return ok(res, {
    mfaRequired: false,
    user: result.user,
    accessToken: result.session.accessToken,
    refreshToken: result.session.refreshToken,
    expiresIn: result.session.expiresInSeconds,
    roles: result.roles,
    permissions: result.permissions,
    accessibleAreas: result.accessibleAreas,
    activeTenantId: result.activeTenantId,
    memberships: result.memberships,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth?.sessionId)
    throw new UnauthorizedError("No active session to end.");
  await revokeSession(req.auth.sessionId, {
    userId: req.auth.userId,
    reason: "USER_LOGOUT",
  });
  return noContent(res);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as RefreshInput;
  const rotated = await rotateRefreshToken(refreshToken, req);
  const activeTenantId = rotated.session.activeTenantId ?? null;
  const { roles, permissions } = await loadAuthorization(
    rotated.user.id,
    activeTenantId,
  );
  const memberships =
    rotated.user.userType === "TENANT_USER"
      ? await listTenantMemberships(rotated.user.id)
      : [];
  return ok(res, {
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken,
    expiresIn: rotated.expiresInSeconds,
    user: authService.toPublicProfile(rotated.user),
    roles,
    permissions,
    accessibleAreas: authService.accessibleAreasFromPermissions(permissions),
    activeTenantId,
    memberships,
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  const result = await authService.getCurrentUser(
    req.auth.userId,
    req.auth.activeTenantId ?? null,
  );
  return ok(res, result);
});

export const switchTenant = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new UnauthorizedError();
    if (!req.auth.sessionId)
      throw new ForbiddenError(
        "Tenant switching requires an interactive session.",
      );
    const { tenantId } = req.body as SwitchTenantInput;
    const access = await resolveTenantAccess(req.auth.userId, tenantId);
    await setSessionActiveTenant(req.auth.sessionId, access.activeTenantId);
    const { roles, permissions } = await loadAuthorization(
      req.auth.userId,
      access.activeTenantId,
    );
    const accessToken = signAccessToken({
      userId: req.auth.userId,
      sessionId: req.auth.sessionId,
      amr: req.auth.mfaVerified ? ["pwd", "mfa"] : ["pwd"],
      tenantId: access.activeTenantId,
    });
    const memberships = await listTenantMemberships(req.auth.userId);
    return ok(res, {
      activeTenantId: access.activeTenantId,
      accessToken,
      roles,
      permissions,
      memberships,
    });
  },
);

export const acceptInvite = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, password } = req.body as InvitationAcceptInput;
    const result = await acceptInvitation(token, password, req);
    return created(res, {
      userId: result.userId,
      email: result.email,
      message: "Invitation accepted. You can now sign in.",
    });
  },
);
