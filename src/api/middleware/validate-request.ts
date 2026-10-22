import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodTypeAny, z } from "zod";
import { ValidationError } from "../../shared/errors";

export interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

function formatZodError(
  error: ZodError,
): { field: string; message: string; code: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    message: issue.message,
    code: issue.code,
  }));
}

export function validateRequest(schemas: RequestSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params);
        req.params = parsed as Request["params"];
      }
      if (schemas.query) {
        Object.defineProperty(req, "query", {
          value: schemas.query.parse(req.query),
          writable: true,
          configurable: true,
        });
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {});
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new ValidationError(
            "Request validation failed.",
            formatZodError(error),
          ),
        );
        return;
      }
      next(error);
    }
  };
}

export const idParamSchema = z.object({
  id: z.string().min(1, "Identifier is required"),
});
