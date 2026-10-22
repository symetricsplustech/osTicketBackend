import type { Request, Response } from "express";
import { ok } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  getMyAccount,
  getMyPreferences,
  getMyRecentActivity,
  getMySecurity,
  updateMyPreferences,
  updateMyProfile,
} from "../../services/tenantadmin/myAccount.service";
import type {
  UpdatePreferencesInput,
  UpdateProfileInput,
} from "../../validators/tenantadmin/myAccount.validators";
import { tenantActor } from "./actor";

export const getMyAccountHandler = asyncHandler(
  async (req: Request, res: Response) =>
    ok(res, await getMyAccount(tenantActor(req))),
);

export const updateMyProfileHandler = asyncHandler(
  async (req: Request, res: Response) =>
    ok(
      res,
      await updateMyProfile(tenantActor(req), req.body as UpdateProfileInput),
    ),
);

export const getMyPreferencesHandler = asyncHandler(
  async (req: Request, res: Response) =>
    ok(res, await getMyPreferences(tenantActor(req))),
);

export const updateMyPreferencesHandler = asyncHandler(
  async (req: Request, res: Response) =>
    ok(
      res,
      await updateMyPreferences(
        tenantActor(req),
        req.body as UpdatePreferencesInput,
      ),
    ),
);

export const getMySecurityHandler = asyncHandler(
  async (req: Request, res: Response) =>
    ok(res, await getMySecurity(tenantActor(req))),
);

export const getMyRecentActivityHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 20);
    return ok(
      res,
      await getMyRecentActivity(
        tenantActor(req),
        Number.isFinite(limit) ? limit : 20,
      ),
    );
  },
);
