import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  cancelWorkflowRun,
  createWorkflowTemplate,
  getWorkflowRun,
  getWorkflowTemplate,
  listTenantWorkflowAssignments,
  listWorkflowRuns,
  listWorkflowTemplates,
  listWorkflowTemplateVersions,
  publishWorkflowTemplate,
  replaceTenantWorkflowAssignments,
  retireWorkflowTemplate,
  updateWorkflowTemplate,
  validateWorkflowTemplate,
} from "../../services/saasadmin/workflow-management.service";
import type {
  CreateWorkflowTemplateInput,
  TenantWorkflowAssignmentEntryInput,
  UpdateWorkflowTemplateInput,
  ValidateWorkflowDefinitionBodyInput,
} from "../../validators/saasadmin/workflow-management.validators";

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listTemplatesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listWorkflowTemplates(req);
    return paginated(res, rows, meta);
  },
);

export const createTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const template = await createWorkflowTemplate(
      req.body as CreateWorkflowTemplateInput,
      actorOf(req),
    );
    return created(res, template);
  },
);

export const getTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const template = await getWorkflowTemplate(req.params.templateId);
    return ok(res, template);
  },
);

export const updateTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const template = await updateWorkflowTemplate(
      req.params.templateId,
      req.body as UpdateWorkflowTemplateInput,
      actorOf(req),
    );
    return ok(res, template);
  },
);

export const validateTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { definition } = req.body as ValidateWorkflowDefinitionBodyInput;
    const result = await validateWorkflowTemplate(
      req.params.templateId,
      definition,
    );
    return ok(res, result);
  },
);

export const publishTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await publishWorkflowTemplate(
      req.params.templateId,
      actorOf(req),
    );
    return created(res, result, { message: "Workflow template published." });
  },
);

export const retireTemplateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const template = await retireWorkflowTemplate(
      req.params.templateId,
      actorOf(req),
    );
    return ok(res, template, { message: "Workflow template retired." });
  },
);

export const listTemplateVersionsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listWorkflowTemplateVersions(
      req.params.templateId,
      req,
    );
    return paginated(res, rows, meta);
  },
);

export const listRunsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listWorkflowRuns(req);
    return paginated(res, rows, meta);
  },
);

export const getRunHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const run = await getWorkflowRun(req.params.runId);
    return ok(res, run);
  },
);

export const cancelRunHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const run = await cancelWorkflowRun(req.params.runId, actorOf(req));
    return ok(res, run, { message: "Workflow run cancelled." });
  },
);

export const listTenantAssignmentsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listTenantWorkflowAssignments(
      req.params.tenantId,
      req,
    );
    return paginated(res, rows, meta);
  },
);

export const replaceTenantAssignmentsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { assignments } = req.body as {
      assignments: TenantWorkflowAssignmentEntryInput[];
    };
    const result = await replaceTenantWorkflowAssignments(
      req.params.tenantId,
      assignments,
      actorOf(req),
    );
    return ok(res, result, { message: "Tenant workflow assignments updated." });
  },
);
