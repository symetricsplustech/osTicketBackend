import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  createProvider,
  createRule,
  createTemplate,
  disableProvider,
  getDeliveryLog,
  getProvider,
  getTemplate,
  listDeliveryLogs,
  listProviders,
  listRules,
  listTemplates,
  previewTemplate,
  setRuleEnabled,
  testProvider,
  updateProvider,
  updateRule,
  updateTemplate,
  verifyProvider,
} from "../../services/saasadmin/email-notifications.service";
import type {
  CreateProviderInput,
  CreateRuleInput,
  CreateTemplateInput,
  PreviewTemplateInput,
  TestProviderInput,
  UpdateProviderInput,
  UpdateRuleInput,
  UpdateTemplateInput,
} from "../../validators/saasadmin/email-notifications.validators";

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listProvidersHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listProviders(req);
    return paginated(res, rows, meta);
  },
);

export const createProviderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const provider = await createProvider(
      req.body as CreateProviderInput,
      actorOf(req),
    );
    return created(res, provider, {
      message: "Email provider created. Run a test to verify delivery.",
    });
  },
);

export const getProviderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const provider = await getProvider(req.params.providerId!);
    return ok(res, provider);
  },
);

export const updateProviderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const provider = await updateProvider(
      req.params.providerId!,
      req.body as UpdateProviderInput,
      actorOf(req),
    );
    return ok(res, provider);
  },
);

export const testProviderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await testProvider(
      req.params.providerId!,
      req.body as TestProviderInput,
      actorOf(req),
    );
    return ok(res, result, {
      message: result.sent
        ? "Test email sent."
        : "Test email failed. Review the error and provider configuration.",
    });
  },
);

export const verifyProviderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await verifyProvider(req.params.providerId!, actorOf(req));
    return ok(res, result);
  },
);

export const disableProviderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const provider = await disableProvider(
      req.params.providerId!,
      actorOf(req),
    );
    return ok(res, provider, { message: "Email provider disabled." });
  },
);

export const listTemplatesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listTemplates(req);
    return paginated(res, rows, meta);
  },
);

export const createTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const template = await createTemplate(
      req.body as CreateTemplateInput,
      actorOf(req),
    );
    return created(res, template);
  },
);

export const getTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const template = await getTemplate(req.params.templateId!);
    return ok(res, template);
  },
);

export const updateTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const template = await updateTemplate(
      req.params.templateId!,
      req.body as UpdateTemplateInput,
      actorOf(req),
    );
    return ok(res, template);
  },
);

export const previewTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const preview = await previewTemplate(
      req.params.templateId!,
      req.body as PreviewTemplateInput,
    );
    return ok(res, preview);
  },
);

export const listRulesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listRules(req);
    return paginated(res, rows, meta);
  },
);

export const createRuleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const rule = await createRule(req.body as CreateRuleInput, actorOf(req));
    return created(res, rule);
  },
);

export const updateRuleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const rule = await updateRule(
      req.params.ruleId!,
      req.body as UpdateRuleInput,
      actorOf(req),
    );
    return ok(res, rule);
  },
);

export const enableRuleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const rule = await setRuleEnabled(req.params.ruleId!, true, actorOf(req));
    return ok(res, rule, { message: "Notification rule enabled." });
  },
);

export const disableRuleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const rule = await setRuleEnabled(req.params.ruleId!, false, actorOf(req));
    return ok(res, rule, { message: "Notification rule disabled." });
  },
);

export const listDeliveryLogsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listDeliveryLogs(req);
    return paginated(res, rows, meta);
  },
);

export const getDeliveryLogHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const log = await getDeliveryLog(req.params.deliveryId!);
    return ok(res, log);
  },
);
