import type { Session, User } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { UnauthorizedError } from "../../shared/errors";
import { randomToken, sha256 } from "../../shared/utils/crypto";
import { clientIp, userAgent } from "../../shared/utils/sanitize-request";
import { signAccessToken } from "../../api/middleware/authenticate";

export interface IssuedSession {
  session: Session;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface SessionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

function metadataFromRequest(req: Request): SessionMetadata {
  return { ipAddress: clientIp(req), userAgent: userAgent(req) };
}

const REFRESH_TTL_MS = () => env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export async function issueSession(
  user: User,
  req: Request,
  authenticationMethods: string[],
  activeTenantId?: string | null,
): Promise<IssuedSession> {
  if (user.mfaEnabled && !authenticationMethods.includes("mfa")) {
    throw new UnauthorizedError(
      "Multi-factor authentication is required before a session can be issued.",
    );
  }
  const refreshToken = randomToken(48);
  const metadata = metadataFromRequest(req);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS());

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: sha256(refreshToken),
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
      activeTenantId: activeTenantId ?? null,
      mfaVerifiedAt: authenticationMethods.includes("mfa") ? new Date() : null,
      expiresAt,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = signAccessToken({
    userId: user.id,
    sessionId: session.id,
    amr: authenticationMethods,
    tenantId: activeTenantId ?? null,
  });

  return {
    session,
    accessToken,
    refreshToken,
    expiresInSeconds: env.JWT_ACCESS_TTL_MINUTES * 60,
  };
}

export async function rotateRefreshToken(
  refreshToken: string,
  req: Request,
): Promise<IssuedSession & { user: User }> {
  const session = await prisma.session.findFirst({
    where: { refreshTokenHash: sha256(refreshToken) },
    include: { user: true },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() < Date.now()
  ) {
    throw new UnauthorizedError("Refresh token is invalid or has expired.");
  }
  const user = session.user;
  if (
    user.deletedAt ||
    user.status === "SUSPENDED" ||
    user.status === "DEACTIVATED"
  ) {
    throw new UnauthorizedError("Account is not active.");
  }

  const amr = session.mfaVerifiedAt ? ["pwd", "mfa"] : ["pwd"];
  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date(), revokedReason: "ROTATED" },
  });

  const issued = await issueSession(user, req, amr, session.activeTenantId);
  return { ...issued, user };
}

export async function revokeSession(
  sessionId: string,
  options?: { userId?: string; reason?: string },
): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return;
  if (options?.userId && session.userId !== options.userId) {
    throw new UnauthorizedError("Session does not belong to this account.");
  }
  if (!session.revokedAt) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedReason: options?.reason ?? "USER_REVOKED",
      },
    });
  }
}

export async function setSessionActiveTenant(
  sessionId: string,
  tenantId: string,
): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { activeTenantId: tenantId },
  });
}

export async function revokeAllUserSessions(
  userId: string,
  options?: { exceptSessionId?: string; reason?: string },
): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(options?.exceptSessionId
        ? { id: { not: options.exceptSessionId } }
        : {}),
    },
    data: {
      revokedAt: new Date(),
      revokedReason: options?.reason ?? "ALL_REVOKED",
    },
  });
  return result.count;
}

export async function listUserSessions(
  userId: string,
  req?: Request,
): Promise<(Session & { isCurrent: boolean; isActive: boolean })[]> {
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { lastUsedAt: "desc" },
    take: 100,
  });
  const currentId = req?.auth?.sessionId;
  return sessions.map((session) => ({
    ...session,
    isCurrent: session.id === currentId,
    isActive: !session.revokedAt && session.expiresAt.getTime() > Date.now(),
  }));
}

export async function cleanupExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.session.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
    },
  });
  return result.count;
}
