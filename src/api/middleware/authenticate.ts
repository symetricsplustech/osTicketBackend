import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserType } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/database";
import { cache } from "../../config/redis";
import { UnauthorizedError, ForbiddenError } from "../../shared/errors";
import { sha256 } from "../../shared/utils/crypto";
import { recordSecurityEvent } from "../../shared/audit";
import { loadTenantRolesAndPermissions } from "../../services/auth/tenant-access.service";
import type { AuthContext } from "../../shared/types/express";

interface AccessTokenPayload {
  sub: string;
  sid: string;
  typ: "access";
  amr: string[];
  tid?: string;
}

export function signAccessToken(payload: {
  userId: string;
  sessionId: string;
  amr: string[];
  tenantId?: string | null;
}): string {
  const body: AccessTokenPayload = {
    sub: payload.userId,
    sid: payload.sessionId,
    typ: "access",
    amr: payload.amr,
    ...(payload.tenantId ? { tid: payload.tenantId } : {}),
  };
  return jwt.sign(body, env.JWT_SECRET, {
    expiresIn: `${env.JWT_ACCESS_TTL_MINUTES}m`,
    issuer: "itsm-saas-platform",
    audience: "itsm-saas-admin",
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: "itsm-saas-platform",
    audience: "itsm-saas-admin",
  }) as jwt.JwtPayload & AccessTokenPayload;
  if (decoded.typ !== "access" || !decoded.sub || !decoded.sid) {
    throw new UnauthorizedError("Invalid access token.");
  }
  return decoded;
}

const PERMISSIONS_CACHE_TTL = 60;

export async function loadPermissions(
  userId: string,
): Promise<{ roles: string[]; permissions: string[] }> {
  const cacheKey = `auth:permissions:${userId}`;
  const cached = await cache.getJson<{
    roles: string[];
    permissions: string[];
  }>(cacheKey);
  if (cached) return cached;

  const assignments = await prisma.staffRoleAssignment.findMany({
    where: { userId, role: { deletedAt: null } },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });

  const roles = assignments.map((assignment) => assignment.role.key);
  const permissionSet = new Set<string>();
  for (const assignment of assignments) {
    for (const rolePermission of assignment.role.permissions) {
      permissionSet.add(rolePermission.permission.code);
    }
  }
  const result = { roles, permissions: Array.from(permissionSet) };
  await cache.setJson(cacheKey, result, PERMISSIONS_CACHE_TTL);
  return result;
}

export async function invalidatePermissionCache(userId: string): Promise<void> {
  await cache.del(`auth:permissions:${userId}`);
}

/**
 * Resolves the effective authorization for a user. Platform staff receive their
 * platform roles/permissions. Tenant users additionally receive the roles and
 * tenant-scoped permissions granted for their active organization.
 */
export async function loadAuthorization(
  userId: string,
  activeTenantId?: string | null,
): Promise<{
  roles: string[];
  permissions: string[];
  membershipId: string | null;
}> {
  const platform = await loadPermissions(userId);
  if (!activeTenantId) {
    return {
      roles: platform.roles,
      permissions: platform.permissions,
      membershipId: null,
    };
  }
  const tenant = await loadTenantRolesAndPermissions(userId, activeTenantId);
  const roles = Array.from(new Set([...platform.roles, ...tenant.roles]));
  const permissions = Array.from(
    new Set([...platform.permissions, ...tenant.permissions]),
  );
  return { roles, permissions, membershipId: tenant.membershipId };
}

async function authenticateWithApiKey(
  req: Request,
  res: Response,
  apiKeyHeader: string,
): Promise<AuthContext> {
  const keyHash = sha256(apiKeyHeader);
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey || apiKey.revokedAt) {
    throw new UnauthorizedError("API key is invalid, revoked or expired.");
  }
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError("API key is invalid, revoked or expired.");
  }

  void prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  const scopes = Array.isArray(apiKey.scopes)
    ? (apiKey.scopes as unknown[]).map(String)
    : [];
  const auth: AuthContext = {
    userId: `apikey:${apiKey.id}`,
    email: `api-key:${apiKey.name}`,
    userType: "PLATFORM_STAFF" as UserType,
    sessionId: null,
    roles: ["api-key"],
    permissions: scopes,
    mfaVerified: true,
    apiKeyId: apiKey.id,
  };

  res.on("finish", () => {
    void prisma.apiKeyUsage
      .create({
        data: {
          apiKeyId: apiKey.id,
          method: req.method,
          path: req.originalUrl.slice(0, 512),
          statusCode: res.statusCode,
          ipAddress: req.ip ?? null,
        },
      })
      .catch(() => undefined);
  });

  return auth;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const apiKeyHeader = req.headers["x-api-key"];
    if (typeof apiKeyHeader === "string" && apiKeyHeader.length > 0) {
      req.auth = await authenticateWithApiKey(req, res, apiKeyHeader);
      next();
      return;
    }

    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedError("Authentication is required.");
    }
    const token = header.slice("Bearer ".length).trim();
    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError("Access token is invalid or has expired.");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt)
      throw new UnauthorizedError("Account no longer exists.");
    if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
      throw new ForbiddenError(
        "Account is not active. Contact an administrator.",
      );
    }
    if (user.status === "INVITED" && !payload.amr.includes("invite")) {
      throw new ForbiddenError("Account invitation has not been accepted yet.");
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedError("Session has ended. Please sign in again.");
    }
    if (session.userId !== user.id) {
      throw new UnauthorizedError("Session does not belong to this account.");
    }

    if (user.userType === "PLATFORM_STAFF") {
      const { roles, permissions } = await loadPermissions(user.id);
      req.auth = {
        userId: user.id,
        email: user.email,
        userType: user.userType,
        sessionId: session.id,
        roles,
        permissions,
        mfaVerified: payload.amr.includes("mfa"),
        activeTenantId: null,
        membershipId: null,
      };
    } else {
      const activeTenantId = payload.tid ?? session.activeTenantId ?? null;
      if (!activeTenantId) {
        throw new UnauthorizedError(
          "No active organization is selected for this session.",
        );
      }
      const membership = await prisma.tenantMembership.findFirst({
        where: { tenantId: activeTenantId, userId: user.id },
        include: {
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      });
      if (!membership || membership.tenant.deletedAt) {
        throw new ForbiddenError(
          "No membership found for the selected organization.",
        );
      }
      if (membership.status !== "ACTIVE") {
        throw new ForbiddenError(
          "Your membership in this organization is not active.",
        );
      }
      if (membership.tenant.status === "ARCHIVED") {
        throw new ForbiddenError("This organization is archived.");
      }
      if (membership.tenant.status === "FAILED") {
        throw new ForbiddenError("This organization is not available.");
      }
      const tenantAuth = await loadTenantRolesAndPermissions(
        user.id,
        activeTenantId,
      );
      req.tenantContext = {
        tenantId: membership.tenant.id,
        tenantSlug: membership.tenant.slug,
        tenantName: membership.tenant.name,
      };
      req.auth = {
        userId: user.id,
        email: user.email,
        userType: user.userType,
        sessionId: session.id,
        roles: tenantAuth.roles,
        permissions: tenantAuth.permissions,
        mfaVerified: payload.amr.includes("mfa"),
        activeTenantId,
        membershipId: membership.id,
      };
    }

    void prisma.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      void recordSecurityEvent({
        eventType: "auth.access.denied",
        severity: "LOW",
        req,
        details: { reason: error.message, path: req.originalUrl },
      });
    }
    next(error);
  }
}
