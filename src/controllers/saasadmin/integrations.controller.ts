import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  createIntegration,
  getIntegration,
  listIntegrationLogs,
  listIntegrations,
  setIntegrationEnabled,
  testIntegration,
  updateIntegration,
} from "../../services/saasadmin/integrations.service";
import type {
  CreateIntegrationInput,
  UpdateIntegrationInput,
} from "../../validators/saasadmin/integrations.validators";

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listIntegrationsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listIntegrations(req);
    return paginated(res, rows, meta);
  },
);

export const createIntegrationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const integration = await createIntegration(
      req.body as CreateIntegrationInput,
      actorOf(req),
    );
    return created(res, integration, {
      message:
        "Integration created. Run a connectivity test before enabling it.",
    });
  },
);

export const getIntegrationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const integration = await getIntegration(req.params.integrationId!);
    return ok(res, integration);
  },
);

export const updateIntegrationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const integration = await updateIntegration(
      req.params.integrationId!,
      req.body as UpdateIntegrationInput,
      actorOf(req),
    );
    return ok(res, integration);
  },
);

export const testIntegrationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await testIntegration(
      req.params.integrationId!,
      actorOf(req),
    );
    return ok(res, result);
  },
);

export const enableIntegrationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const integration = await setIntegrationEnabled(
      req.params.integrationId!,
      true,
      actorOf(req),
    );
    return ok(res, integration, { message: "Integration enabled." });
  },
);

export const disableIntegrationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const integration = await setIntegrationEnabled(
      req.params.integrationId!,
      false,
      actorOf(req),
    );
    return ok(res, integration, { message: "Integration disabled." });
  },
);

export const listIntegrationLogsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listIntegrationLogs(
      req.params.integrationId!,
      req,
    );
    return paginated(res, rows, meta);
  },
);
