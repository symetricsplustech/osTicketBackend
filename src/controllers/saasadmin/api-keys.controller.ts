import type { Request, Response } from "express";
import type { PaginationMeta } from "../../shared/response";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  createApiKey,
  getApiKey,
  getApiKeyUsage,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  updateApiKey,
} from "../../services/saasadmin/api-keys.service";
import type {
  CreateApiKeyInput,
  RevokeApiKeyInput,
  UpdateApiKeyInput,
} from "../../validators/saasadmin/api-keys.validators";

const SECRET_ONCE_MESSAGE =
  "Copy this secret now — it is shown only once and cannot be retrieved again.";

export const listApiKeysHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listApiKeys(req);
    return paginated(res, rows, meta);
  },
);

export const createApiKeyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { apiKey, secret } = await createApiKey(
      req.body as CreateApiKeyInput,
      req,
    );
    return created(
      res,
      { ...apiKey, secret },
      { message: SECRET_ONCE_MESSAGE },
    );
  },
);

export const getApiKeyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const apiKey = await getApiKey(req.params.keyId!);
    return ok(res, apiKey);
  },
);

export const updateApiKeyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const apiKey = await updateApiKey(
      req.params.keyId!,
      req.body as UpdateApiKeyInput,
      req,
    );
    return ok(res, apiKey);
  },
);

export const rotateApiKeyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { apiKey, secret } = await rotateApiKey(req.params.keyId!, req);
    return created(
      res,
      { ...apiKey, secret },
      { message: SECRET_ONCE_MESSAGE },
    );
  },
);

export const revokeApiKeyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const apiKey = await revokeApiKey(
      req.params.keyId!,
      req.body as RevokeApiKeyInput,
      req,
    );
    return ok(res, apiKey, { message: "API key revoked." });
  },
);

export const getApiKeyUsageHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta, aggregate } = await getApiKeyUsage(
      req.params.keyId!,
      req,
    );
    const metaWithAggregate: PaginationMeta & { aggregate: typeof aggregate } =
      { ...meta, aggregate };
    return paginated(res, rows, metaWithAggregate);
  },
);
