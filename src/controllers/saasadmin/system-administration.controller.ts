import type { Request, Response } from "express";
import { ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  cancelJob,
  getJob,
  getMaintenanceSettings,
  getQueues,
  getServiceDetail,
  getSystemHealth,
  getVersion,
  listJobs,
  listServices,
  retryJob,
  runDiagnostics,
  updateMaintenanceSettings,
} from "../../services/saasadmin/system-administration.service";

export const health = asyncHandler(async (_req: Request, res: Response) =>
  ok(res, await getSystemHealth()),
);

export const services = asyncHandler(async (_req: Request, res: Response) =>
  ok(res, await listServices()),
);

export const serviceDetail = asyncHandler(async (req: Request, res: Response) =>
  ok(res, await getServiceDetail(req.params.serviceKey!)),
);

export const queues = asyncHandler(async (_req: Request, res: Response) =>
  ok(res, await getQueues()),
);

export const jobs = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listJobs(req);
  return paginated(res, rows, meta);
});

export const jobDetail = asyncHandler(async (req: Request, res: Response) =>
  ok(res, await getJob(req.params.jobId!)),
);

export const retryJobHandler = asyncHandler(
  async (req: Request, res: Response) =>
    ok(res, await retryJob(req.params.jobId!, req)),
);

export const cancelJobHandler = asyncHandler(
  async (req: Request, res: Response) =>
    ok(res, await cancelJob(req.params.jobId!, req)),
);

export const maintenance = asyncHandler(async (_req: Request, res: Response) =>
  ok(res, await getMaintenanceSettings()),
);

export const updateMaintenance = asyncHandler(
  async (req: Request, res: Response) =>
    ok(res, await updateMaintenanceSettings(req.body, req)),
);

export const diagnostics = asyncHandler(async (_req: Request, res: Response) =>
  ok(res, await runDiagnostics()),
);

export const version = asyncHandler(async (_req: Request, res: Response) =>
  ok(res, await getVersion()),
);
