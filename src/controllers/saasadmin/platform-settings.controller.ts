import type { Request, Response } from "express";
import { ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  getBranding,
  getGroups,
  getLocalization,
  getRetention,
  getSecurity,
  getSetting,
  listFeatureFlags,
  listSettings,
  updateBranding,
  updateFeatureFlag,
  updateLocalization,
  updateRetention,
  updateSecurity,
  updateSetting,
} from "../../services/saasadmin/platform-settings.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listSettings(req);
  return paginated(res, rows, meta);
});

export const groups = asyncHandler(async (_req: Request, res: Response) =>
  ok(res, await getGroups()),
);

export const getByKey = asyncHandler(async (req: Request, res: Response) =>
  ok(res, await getSetting(req.params.key!)),
);

export const patchByKey = asyncHandler(async (req: Request, res: Response) =>
  ok(res, await updateSetting(req.params.key!, req.body.value, req)),
);

export const branding = asyncHandler(async (_req: Request, res: Response) =>
  ok(res, await getBranding()),
);
export const patchBranding = asyncHandler(async (req: Request, res: Response) =>
  ok(res, await updateBranding(req.body, req)),
);

export const localization = asyncHandler(async (_req: Request, res: Response) =>
  ok(res, await getLocalization()),
);
export const patchLocalization = asyncHandler(
  async (req: Request, res: Response) =>
    ok(res, await updateLocalization(req.body, req)),
);

export const security = asyncHandler(async (_req: Request, res: Response) =>
  ok(res, await getSecurity()),
);
export const patchSecurity = asyncHandler(async (req: Request, res: Response) =>
  ok(res, await updateSecurity(req.body, req)),
);

export const retention = asyncHandler(async (_req: Request, res: Response) =>
  ok(res, await getRetention()),
);
export const patchRetention = asyncHandler(
  async (req: Request, res: Response) =>
    ok(res, await updateRetention(req.body, req)),
);

export const featureFlags = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listFeatureFlags(req);
    return paginated(res, rows, meta);
  },
);

export const patchFeatureFlag = asyncHandler(
  async (req: Request, res: Response) =>
    ok(res, await updateFeatureFlag(req.params.flagKey!, req.body, req)),
);
