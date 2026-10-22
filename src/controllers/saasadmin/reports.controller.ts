import type { Request, Response } from "express";
import { ok, accepted, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  cancelExport,
  createReportJob,
  getActivityOverview,
  getCatalog,
  getDownload,
  getRun,
  getSecurityOverview,
  getTenantUsageOverview,
  listRuns,
  listExports,
  getExport,
  runReport,
} from "../../services/saasadmin/reports.service";
import type {
  ExportReportInput,
  RunReportInput,
} from "../../validators/saasadmin/reports.validators";

export const catalog = asyncHandler(async (_req: Request, res: Response) =>
  ok(res, await getCatalog()),
);

export const run = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as RunReportInput;
  const result = await runReport(
    { reportKey: input.reportKey, filters: input.filters, limit: input.limit },
    req.auth!.userId,
    req,
  );
  return ok(res, result);
});

export const runs = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listRuns(req);
  return paginated(res, rows, meta);
});

export const runDetail = asyncHandler(async (req: Request, res: Response) =>
  ok(res, await getRun(req.params.runId!)),
);

export const download = asyncHandler(async (req: Request, res: Response) => {
  const { job, absolutePath, fileName } = await getDownload(req.params.runId!);
  res.setHeader(
    "Content-Type",
    job.format === "CSV" ? "text/csv" : "application/json",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("X-Report-Run-Id", job.id);
  return res.sendFile(absolutePath);
});

export const exportsList = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listExports(req);
  return paginated(res, rows, meta);
});

export const createExport = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as ExportReportInput;
    const job = await createReportJob({
      reportKey: input.reportKey,
      kind: "EXPORT",
      format: input.format,
      filters: (input.filters ?? {}) as Record<string, unknown>,
      requestedById: req.auth!.userId,
    });
    return accepted(res, job, {
      message:
        "Export queued. Poll the export status endpoint until it completes, then download.",
    });
  },
);

export const exportStatus = asyncHandler(async (req: Request, res: Response) =>
  ok(res, await getExport(req.params.exportId!)),
);

export const cancelExportHandler = asyncHandler(
  async (req: Request, res: Response) =>
    ok(res, await cancelExport(req.params.exportId!, req)),
);

export const tenantUsage = asyncHandler(async (req: Request, res: Response) =>
  ok(res, await getTenantUsageOverview(req)),
);

export const activity = asyncHandler(async (req: Request, res: Response) =>
  ok(res, await getActivityOverview(req)),
);

export const securitySummary = asyncHandler(
  async (req: Request, res: Response) =>
    ok(res, await getSecurityOverview(req)),
);
