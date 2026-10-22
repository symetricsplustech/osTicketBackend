import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  assertAnyPermission,
  assertPermission,
} from "../../shared/permissions/guard";

export function authorize(...codes: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (codes.length === 1) assertPermission(req.auth, codes[0]!);
      else assertAnyPermission(req.auth, codes);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authorizeAll(...codes: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (codes.length === 0)
        throw new Error("authorizeAll requires at least one permission code");
      for (const code of codes) assertPermission(req.auth, code);
      next();
    } catch (error) {
      next(error);
    }
  };
}
