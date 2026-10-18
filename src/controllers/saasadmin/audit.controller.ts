import type { Request, Response } from 'express';
import { ok, accepted, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import {
  getEvent,
  listActors,
  loginEvents,
  privilegedActions,
  requestAuditExport,
  resourceHistory,
  searchEvents,
  securityEvents,
} from '../../services/saasadmin/audit.service';
import type { AuditExportInput } from '../../validators/saasadmin/audit.validators';

export const events = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await searchEvents(req);
  return paginated(res, rows, meta);
});

export const event = asyncHandler(async (req: Request, res: Response) => ok(res, await getEvent(req.params.eventId!)));

export const actors = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listActors(req);
  return paginated(res, rows, meta);
});

export const resourceHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await resourceHistory(String(req.query.resourceType), String(req.query.resourceId), req);
  return paginated(res, rows, meta);
});

export const securityEventsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await securityEvents(req);
  return paginated(res, rows, meta);
});

export const loginEventsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await loginEvents(req);
  return paginated(res, rows, meta);
});

export const privilegedActionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await privilegedActions(req);
  return paginated(res, rows, meta);
});

export const requestExport = asyncHandler(async (req: Request, res: Response) => {
  const job = await requestAuditExport(req.body as AuditExportInput, req.auth!.userId);
  return accepted(res, job, { message: 'Audit export has been queued. Track it through the report runs endpoint.' });
});
