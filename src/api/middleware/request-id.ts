import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const HEADER = "x-request-id";

export function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers[HEADER];
  const id =
    typeof incoming === "string" &&
    incoming.length > 0 &&
    incoming.length <= 128
      ? incoming
      : crypto.randomUUID();
  req.requestId = id;
  req.startedAt = Date.now();
  res.setHeader("X-Request-Id", id);
  next();
}
