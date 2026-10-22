import type { User } from "@prisma/client";
import type { Request } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors";
import { normaliseEmail } from "../../shared/utils/sanitize";
import { verifyPassword } from "../../shared/utils/passwords";
import { recordLoginEvent } from "../../shared/audit";
import { loadAuthorization } from "../../api/middleware/authenticate";
import { issueSession, type IssuedSession } from "./session.service";
import {
  listTenantMemberships,
  resolveLoginTenant,
  type TenantMembershipSummary,
} from "./tenant-access.service";
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export interface LoginSuccess {
  mfaRequired: false;
  user: PublicProfile;
  session: IssuedSession;
  roles: string[];
  permissions: string[];
  accessibleAreas: string[];
  activeTenantId: string | null;
  memberships: TenantMembershipSummary[];
}

export type LoginResult = MfaChallenge | LoginSuccess;

export interface PublicProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  timezone: string;
  locale: string;
  userType: string;
  status: string;
  mfaEnabled: boolean;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export function toPublicProfile(user: User): PublicProfile {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    jobTitle: user.jobTitle,
    timezone: user.timezone,
    locale: user.locale,
    userType: user.userType,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export function accessibleAreasFromPermissions(
  permissions: string[],
): string[] {
  const areas = new Set<string>();
  for (const permission of permissions) {
    if (permission === "*") return ["all"];
    const match = /^admin\.([a-z-]+)\./.exec(permission);
    if (match) areas.add(match[1]!);
  }
  return Array.from(areas).sort();
}

export async function verifyCredentials(
  email: string,
  password: string,
  req: Request,
): Promise<User> {
  const normalised = normaliseEmail(email);
  const user = await prisma.user.findFirst({
    where: { email: normalised },
  });

  if (!user || user.deletedAt) {
    await recordLoginEvent({
      email: normalised,
      outcome: "FAILURE",
      failureReason: "UNKNOWN_ACCOUNT",
      req,
    });
    throw new UnauthorizedError("Invalid email address or password.");
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await recordLoginEvent({
      email: normalised,
      outcome: "LOCKED",
      userId: user.id,
      failureReason: "ACCOUNT_LOCKED",
      req,
    });
    throw new ForbiddenError(
      "Account is temporarily locked due to failed sign-in attempts. Try again later.",
    );
  }

  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
    await recordLoginEvent({
      email: normalised,
      outcome: "FAILURE",
      userId: user.id,
      failureReason: "ACCOUNT_INACTIVE",
      req,
    });
    throw new ForbiddenError(
      "Account is not active. Contact an administrator.",
    );
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    const failedAttempts = user.failedLoginAttempts + 1;
    const shouldLock = failedAttempts >= env.MAX_LOGIN_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: failedAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + env.LOGIN_LOCK_MINUTES * 60 * 1000)
          : user.lockedUntil,
      },
    });
    await recordLoginEvent({
      email: normalised,
      outcome: shouldLock ? "LOCKED" : "FAILURE",
      userId: user.id,
      failureReason: "INVALID_PASSWORD",
      req,
    });
    throw new UnauthorizedError("Invalid email address or password.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  return user;
}

export function createMfaChallengeToken(userId: string): string {
  return jwt.sign({ sub: userId, typ: "mfa-challenge" }, env.JWT_SECRET, {
    expiresIn: "5m",
    issuer: "itsm-saas-platform",
    audience: "itsm-saas-admin",
  });
}

export function verifyMfaChallengeToken(token: string): string {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: "itsm-saas-platform",
      audience: "itsm-saas-admin",
    }) as jwt.JwtPayload & { typ?: string };
    if (decoded.typ !== "mfa-challenge" || !decoded.sub) {
      throw new UnauthorizedError("MFA challenge is invalid or has expired.");
    }
    return decoded.sub;
  } catch {
    throw new UnauthorizedError("MFA challenge is invalid or has expired.");
  }
}

export async function buildLoginSuccess(
  user: User,
  req: Request,
  amr: string[],
  activeTenantId: string | null = null,
): Promise<LoginSuccess> {
  const issued = await issueSession(user, req, amr, activeTenantId);
  const { roles, permissions } = await loadAuthorization(
    user.id,
    activeTenantId,
  );
  const memberships =
    user.userType === "TENANT_USER" ? await listTenantMemberships(user.id) : [];
  await recordLoginEvent({
    email: user.email,
    outcome: "SUCCESS",
    userId: user.id,
    req,
  });
  return {
    mfaRequired: false,
    user: toPublicProfile(user),
    session: issued,
    roles,
    permissions,
    accessibleAreas: accessibleAreasFromPermissions(permissions),
    activeTenantId,
    memberships,
  };
}

export async function login(
  email: string,
  password: string,
  req: Request,
): Promise<LoginResult> {
  const user = await verifyCredentials(email, password, req);
  const verifiedFactor = await prisma.mfaFactor.findFirst({
    where: { userId: user.id, verifiedAt: { not: null } },
  });

  if (user.mfaEnabled && verifiedFactor) {
    await recordLoginEvent({
      email: user.email,
      outcome: "MFA_REQUIRED",
      userId: user.id,
      req,
    });
    return { mfaRequired: true, mfaToken: createMfaChallengeToken(user.id) };
  }

  const { activeTenantId } = await resolveLoginTenant(user.id, user.userType);
  return buildLoginSuccess(user, req, ["pwd"], activeTenantId);
}

export async function getCurrentUser(
  userId: string,
  activeTenantId: string | null = null,
): Promise<{
  profile: PublicProfile;
  roles: string[];
  permissions: string[];
  accessibleAreas: string[];
  activeTenantId: string | null;
  memberships: TenantMembershipSummary[];
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt)
    throw new UnauthorizedError("Account no longer exists.");
  const { roles, permissions } = await loadAuthorization(
    user.id,
    activeTenantId,
  );
  const memberships =
    user.userType === "TENANT_USER" ? await listTenantMemberships(user.id) : [];
  return {
    profile: toPublicProfile(user),
    roles,
    permissions,
    accessibleAreas: accessibleAreasFromPermissions(permissions),
    activeTenantId,
    memberships,
  };
}
