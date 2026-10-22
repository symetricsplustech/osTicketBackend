import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  createBusinessCalendar,
  createEscalationRule,
  createSlaPolicy,
  getSlaPolicy,
  listBusinessCalendars,
  listEscalationRules,
  listSlaPolicies,
  listTenantSlaAssignments,
  replaceTenantSlaAssignments,
  setSlaPolicyStatus,
  updateBusinessCalendar,
  updateEscalationRule,
  updateSlaPolicy,
} from "../../services/saasadmin/sla-management.service";
import type {
  CreateBusinessCalendarInput,
  CreateEscalationRuleInput,
  CreateSlaPolicyInput,
  TenantSlaAssignmentsInput,
  UpdateBusinessCalendarInput,
  UpdateEscalationRuleInput,
  UpdateSlaPolicyInput,
} from "../../validators/saasadmin/sla-management.validators";

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listSlaPoliciesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listSlaPolicies(req);
    return paginated(res, rows, meta);
  },
);

export const createSlaPolicyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const policy = await createSlaPolicy(
      req.body as CreateSlaPolicyInput,
      actorOf(req),
    );
    return created(res, policy);
  },
);

export const getSlaPolicyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const policy = await getSlaPolicy(req.params.policyId);
    return ok(res, policy);
  },
);

export const updateSlaPolicyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const policy = await updateSlaPolicy(
      req.params.policyId,
      req.body as UpdateSlaPolicyInput,
      actorOf(req),
    );
    return ok(res, policy);
  },
);

export const enableSlaPolicyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const policy = await setSlaPolicyStatus(
      req.params.policyId,
      "ENABLED",
      actorOf(req),
    );
    return ok(res, policy, { message: "SLA policy enabled." });
  },
);

export const disableSlaPolicyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const policy = await setSlaPolicyStatus(
      req.params.policyId,
      "DISABLED",
      actorOf(req),
    );
    return ok(res, policy, { message: "SLA policy disabled." });
  },
);

export const listBusinessCalendarsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listBusinessCalendars(req);
    return paginated(res, rows, meta);
  },
);

export const createBusinessCalendarHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const calendar = await createBusinessCalendar(
      req.body as CreateBusinessCalendarInput,
      actorOf(req),
    );
    return created(res, calendar);
  },
);

export const updateBusinessCalendarHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const calendar = await updateBusinessCalendar(
      req.params.calendarId,
      req.body as UpdateBusinessCalendarInput,
      actorOf(req),
    );
    return ok(res, calendar);
  },
);

export const listEscalationRulesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listEscalationRules(req);
    return paginated(res, rows, meta);
  },
);

export const createEscalationRuleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const rule = await createEscalationRule(
      req.body as CreateEscalationRuleInput,
      actorOf(req),
    );
    return created(res, rule);
  },
);

export const updateEscalationRuleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const rule = await updateEscalationRule(
      req.params.ruleId,
      req.body as UpdateEscalationRuleInput,
      actorOf(req),
    );
    return ok(res, rule);
  },
);

export const listTenantSlaAssignmentsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listTenantSlaAssignments(
      req.params.tenantId,
      req,
    );
    return paginated(res, rows, meta);
  },
);

export const replaceTenantSlaAssignmentsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { slaPolicyIds } = req.body as TenantSlaAssignmentsInput;
    const assignments = await replaceTenantSlaAssignments(
      req.params.tenantId,
      slaPolicyIds,
      actorOf(req),
    );
    return ok(res, assignments);
  },
);
