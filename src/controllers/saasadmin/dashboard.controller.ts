import type { Request, Response } from 'express';
import { ok } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import {
  getAlerts,
  getPlatformHealth,
  getRecentActivity,
  getSummary,
  getTenantGrowth,
  getTenantStatusBreakdown,
  getWorkQueue,
} from '../../services/saasadmin/dashboard.service';

export const summary = asyncHandler(async (_req: Request, res: Response) => ok(res, await getSummary()));

export const tenantGrowth = asyncHandler(async (req: Request, res: Response) => ok(res, await getTenantGrowth(req)));

export const tenantStatus = asyncHandler(async (_req: Request, res: Response) => ok(res, await getTenantStatusBreakdown()));

export const platformHealth = asyncHandler(async (_req: Request, res: Response) => ok(res, await getPlatformHealth()));

export const recentActivity = asyncHandler(async (req: Request, res: Response) => ok(res, await getRecentActivity(req)));

export const alerts = asyncHandler(async (_req: Request, res: Response) => ok(res, await getAlerts()));

export const workQueue = asyncHandler(async (req: Request, res: Response) => ok(res, await getWorkQueue(req)));
