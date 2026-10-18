import type { Request, Response } from 'express';
import { ok } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { dashboardService } from '../../services/itsm/dashboard.service';

function intParam(value: unknown, fallback: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export const dashboardController = {
  overview: asyncHandler(async (req: Request, res: Response) => ok(res, await dashboardService.overview(tenantActor(req).tenantId))),
  incidentSummary: asyncHandler(async (req: Request, res: Response) => ok(res, await dashboardService.incidentSummary(tenantActor(req).tenantId))),
  workload: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await dashboardService.workload(tenantActor(req).tenantId, intParam(req.query.limit, 10, 100))),
  ),
  trends: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await dashboardService.trends(tenantActor(req).tenantId, intParam(req.query.days, 14, 90))),
  ),
  activity: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await dashboardService.activity(tenantActor(req).tenantId, intParam(req.query.limit, 20, 100))),
  ),
};
