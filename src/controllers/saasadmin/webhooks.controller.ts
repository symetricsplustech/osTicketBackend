import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  createWebhook,
  getWebhook,
  getWebhookDelivery,
  listWebhookDeliveries,
  listWebhooks,
  retryWebhookDelivery,
  rotateWebhookSecret,
  setWebhookEnabled,
  testWebhook,
  updateWebhook,
} from "../../services/saasadmin/webhooks.service";
import type {
  CreateWebhookInput,
  TestWebhookInput,
  UpdateWebhookInput,
} from "../../validators/saasadmin/webhooks.validators";

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

const SECRET_ONCE_MESSAGE =
  "Copy this signing secret now — it is shown only once and cannot be retrieved again.";

export const listWebhooksHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listWebhooks(req);
    return paginated(res, rows, meta);
  },
);

export const createWebhookHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { webhook, secret } = await createWebhook(
      req.body as CreateWebhookInput,
      actorOf(req),
    );
    return created(
      res,
      { ...webhook, secret },
      { message: SECRET_ONCE_MESSAGE },
    );
  },
);

export const getWebhookHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const webhook = await getWebhook(req.params.webhookId!);
    return ok(res, webhook);
  },
);

export const updateWebhookHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const webhook = await updateWebhook(
      req.params.webhookId!,
      req.body as UpdateWebhookInput,
      actorOf(req),
    );
    return ok(res, webhook);
  },
);

export const testWebhookHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const delivery = await testWebhook(
      req.params.webhookId!,
      req.body as TestWebhookInput,
      actorOf(req),
    );
    return ok(res, delivery, {
      message:
        delivery.status === "SUCCESS"
          ? "Test delivery succeeded."
          : "Test delivery did not succeed. Review the delivery error.",
    });
  },
);

export const enableWebhookHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const webhook = await setWebhookEnabled(
      req.params.webhookId!,
      true,
      actorOf(req),
    );
    return ok(res, webhook, { message: "Webhook enabled." });
  },
);

export const disableWebhookHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const webhook = await setWebhookEnabled(
      req.params.webhookId!,
      false,
      actorOf(req),
    );
    return ok(res, webhook, { message: "Webhook disabled." });
  },
);

export const rotateWebhookSecretHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { webhook, secret } = await rotateWebhookSecret(
      req.params.webhookId!,
      actorOf(req),
    );
    return ok(res, { ...webhook, secret }, { message: SECRET_ONCE_MESSAGE });
  },
);

export const listWebhookDeliveriesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listWebhookDeliveries(
      req.params.webhookId!,
      req,
    );
    return paginated(res, rows, meta);
  },
);

export const getWebhookDeliveryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const delivery = await getWebhookDelivery(
      req.params.webhookId!,
      req.params.deliveryId!,
    );
    return ok(res, delivery);
  },
);

export const retryWebhookDeliveryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const delivery = await retryWebhookDelivery(
      req.params.webhookId!,
      req.params.deliveryId!,
      actorOf(req),
    );
    return ok(res, delivery, { message: "Delivery retried." });
  },
);
