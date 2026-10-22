import type { Request, Response } from "express";
import { ok, noContent } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors";
import {
  listUserSessions,
  revokeSession,
} from "../../services/auth/session.service";
import type { SessionIdParam } from "../../validators/auth/session.validators";

export const listSessions = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new UnauthorizedError();
    const sessions = await listUserSessions(req.auth.userId, req);
    return ok(
      res,
      sessions.map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
        revokedReason: session.revokedReason,
        isCurrent: session.isCurrent,
        isActive: session.isActive,
      })),
    );
  },
);

export const revokeSessionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new UnauthorizedError();
    const { sessionId } = req.params as unknown as SessionIdParam;
    const { prisma } = await import("../../config/database");
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) return noContent(res);
    if (session.userId !== req.auth.userId) {
      throw new ForbiddenError("You can only revoke your own sessions.");
    }
    await revokeSession(sessionId, {
      userId: req.auth.userId,
      reason: "USER_REVOKED",
    });
    return noContent(res);
  },
);
