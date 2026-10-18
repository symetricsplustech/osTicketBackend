import type { Request } from 'express';
import { Prisma, type WorkflowRun, type WorkflowTemplate } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError, PreconditionFailedError, ValidationError } from '../../shared/errors';
import { createCrudService } from '../../shared/crud';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import { validateWorkflowDefinition } from '../../validators/saasadmin/workflow-management.validators';
import type {
  CreateWorkflowTemplateInput,
  TenantWorkflowAssignmentEntryInput,
  UpdateWorkflowTemplateInput,
  WorkflowDefinitionInput,
} from '../../validators/saasadmin/workflow-management.validators';

export interface ActorContext {
  actorId?: string | null;
  req?: Request;
}

function definitionErrors(messages: string[]) {
  return messages.map((message) => ({ field: 'definition', message }));
}

export const workflowTemplateCrud = createCrudService<WorkflowTemplate>({
  model: prisma.workflowTemplate as never,
  resourceType: 'workflow-template',
  searchFields: ['key', 'name'],
  filterableFields: ['status'],
  allowedSortFields: ['key', 'name', 'status', 'currentVersion', 'createdAt', 'updatedAt'],
  defaultOrderBy: { createdAt: 'desc' },
  softDelete: true,
  include: {
    _count: { select: { versions: true, runs: true, tenantAssignments: true } },
  },
});

export const workflowRunCrud = createCrudService<WorkflowRun>({
  model: prisma.workflowRun as never,
  resourceType: 'workflow-run',
  searchFields: ['resourceId'],
  filterableFields: ['status', 'templateKey', 'tenantId', 'resourceType'],
  allowedSortFields: ['startedAt', 'completedAt', 'createdAt', 'updatedAt', 'status', 'templateKey'],
  defaultOrderBy: { startedAt: 'desc' },
  include: {
    template: { select: { id: true, key: true, name: true } },
  },
});

export async function listWorkflowTemplates(req: Request) {
  const result = await workflowTemplateCrud.list(req);
  const templateIds = result.rows.map((row) => row.id);

  const currentVersions = templateIds.length
    ? await prisma.workflowVersion.findMany({
        where: { templateId: { in: templateIds } },
        orderBy: { version: 'desc' },
        distinct: ['templateId'],
        select: {
          id: true,
          templateId: true,
          version: true,
          validation: true,
          publishedAt: true,
          publishedById: true,
        },
      })
    : [];

  const versionByTemplate = new Map(currentVersions.map((version) => [version.templateId, version]));

  return {
    ...result,
    rows: result.rows.map((row) => ({
      ...row,
      currentVersionDetail: versionByTemplate.get(row.id) ?? null,
    })),
  };
}

export async function createWorkflowTemplate(
  input: CreateWorkflowTemplateInput,
  actor: ActorContext,
): Promise<WorkflowTemplate> {
  const duplicate = await prisma.workflowTemplate.findUnique({ where: { key: input.key }, select: { id: true } });
  if (duplicate) throw new ConflictError(`A workflow template with the key "${input.key}" already exists.`);

  const validation = validateWorkflowDefinition(input.definition);
  if (!validation.valid) {
    throw new ValidationError('The workflow definition is invalid.', definitionErrors(validation.errors));
  }

  const template = await prisma.workflowTemplate.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      definition: input.definition as unknown as Prisma.InputJsonValue,
      status: 'DRAFT',
      currentVersion: 0,
    },
  });

  await recordAudit({
    action: 'workflow-template.created',
    resourceType: 'workflow-template',
    resourceId: template.id,
    after: template,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return template;
}

export async function getWorkflowTemplate(templateId: string) {
  const template = await prisma.workflowTemplate.findFirst({
    where: { id: templateId, deletedAt: null },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        select: {
          id: true,
          version: true,
          validation: true,
          publishedById: true,
          publishedAt: true,
          createdAt: true,
        },
      },
      _count: { select: { versions: true, runs: true, tenantAssignments: true } },
    },
  });
  if (!template) throw new NotFoundError('Workflow template');

  return {
    ...template,
    versionSummary: template.versions.map((version) => ({
      id: version.id,
      version: version.version,
      valid: version.validation
        ? (version.validation as unknown as { valid?: boolean }).valid === true
        : undefined,
      publishedById: version.publishedById,
      publishedAt: version.publishedAt,
      createdAt: version.createdAt,
    })),
  };
}

export async function updateWorkflowTemplate(
  templateId: string,
  input: UpdateWorkflowTemplateInput,
  actor: ActorContext,
): Promise<WorkflowTemplate> {
  const existing = await prisma.workflowTemplate.findFirst({ where: { id: templateId, deletedAt: null } });
  if (!existing) throw new NotFoundError('Workflow template');
  if (existing.status === 'RETIRED') {
    throw new PreconditionFailedError('Retired workflow templates cannot be updated.');
  }

  const data: Prisma.WorkflowTemplateUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.definition !== undefined) {
    const validation = validateWorkflowDefinition(input.definition);
    if (!validation.valid) {
      throw new ValidationError('The workflow definition is invalid.', definitionErrors(validation.errors));
    }
    data.definition = input.definition as unknown as Prisma.InputJsonValue;
  }

  const updated = await prisma.workflowTemplate.update({ where: { id: templateId }, data });

  await recordAudit({
    action: 'workflow-template.updated',
    resourceType: 'workflow-template',
    resourceId: templateId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function validateWorkflowTemplate(templateId: string, bodyDefinition?: WorkflowDefinitionInput) {
  const template = await prisma.workflowTemplate.findFirst({
    where: { id: templateId, deletedAt: null },
    select: { id: true, key: true, definition: true },
  });
  if (!template) throw new NotFoundError('Workflow template');

  const source = bodyDefinition ?? template.definition;
  const result = validateWorkflowDefinition(source);

  return {
    templateId: template.id,
    templateKey: template.key,
    definitionSource: bodyDefinition ? ('request' as const) : ('stored' as const),
    ...result,
  };
}

export async function publishWorkflowTemplate(templateId: string, actor: ActorContext) {
  const template = await prisma.workflowTemplate.findFirst({ where: { id: templateId, deletedAt: null } });
  if (!template) throw new NotFoundError('Workflow template');
  if (template.status === 'RETIRED') {
    throw new PreconditionFailedError('Retired workflow templates cannot be published.');
  }

  const validation = validateWorkflowDefinition(template.definition);
  if (!validation.valid) {
    throw new ValidationError(
      'The workflow definition must be valid before it can be published.',
      definitionErrors(validation.errors),
    );
  }

  const publishedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.workflowTemplate.findUniqueOrThrow({
      where: { id: templateId },
      select: { currentVersion: true },
    });
    const nextVersion = current.currentVersion + 1;

    const version = await tx.workflowVersion.create({
      data: {
        templateId,
        version: nextVersion,
        definition: template.definition as unknown as Prisma.InputJsonValue,
        validation: validation as unknown as Prisma.InputJsonValue,
        publishedById: actor.actorId ?? null,
        publishedAt,
      },
    });

    const updated = await tx.workflowTemplate.update({
      where: { id: templateId },
      data: { status: 'PUBLISHED', currentVersion: nextVersion },
    });

    return { version, template: updated };
  });

  await recordAudit({
    action: 'workflow-template.published',
    resourceType: 'workflow-template',
    resourceId: templateId,
    before: { status: template.status, currentVersion: template.currentVersion },
    after: {
      status: result.template.status,
      currentVersion: result.template.currentVersion,
      versionId: result.version.id,
    },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({
    eventKey: 'workflow.published',
    tenantId: null,
    payload: {
      templateId,
      key: template.key,
      version: result.version.version,
      versionId: result.version.id,
    },
  });

  return { template: result.template, version: result.version };
}

export async function retireWorkflowTemplate(templateId: string, actor: ActorContext): Promise<WorkflowTemplate> {
  const template = await prisma.workflowTemplate.findFirst({ where: { id: templateId, deletedAt: null } });
  if (!template) throw new NotFoundError('Workflow template');
  if (template.status === 'RETIRED') {
    throw new PreconditionFailedError('This workflow template is already retired.');
  }

  const updated = await prisma.workflowTemplate.update({
    where: { id: templateId },
    data: { status: 'RETIRED' },
  });

  await recordAudit({
    action: 'workflow-template.retired',
    resourceType: 'workflow-template',
    resourceId: templateId,
    before: { status: template.status },
    after: { status: updated.status },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listWorkflowTemplateVersions(templateId: string, req: Request) {
  const template = await prisma.workflowTemplate.findFirst({
    where: { id: templateId, deletedAt: null },
    select: { id: true },
  });
  if (!template) throw new NotFoundError('Workflow template');

  const query = parseListQuery(req);
  const where = { templateId };
  const [rows, total] = await Promise.all([
    prisma.workflowVersion.findMany({
      where,
      orderBy: { version: 'desc' },
      ...paginationArgs(query),
    }),
    prisma.workflowVersion.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function listWorkflowRuns(req: Request) {
  return workflowRunCrud.list(req);
}

export async function getWorkflowRun(runId: string) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      template: {
        select: { id: true, key: true, name: true, status: true, currentVersion: true },
      },
    },
  });
  if (!run) throw new NotFoundError('Workflow run');
  return run;
}

export async function cancelWorkflowRun(runId: string, actor: ActorContext): Promise<WorkflowRun> {
  const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
  if (!run) throw new NotFoundError('Workflow run');
  if (run.status !== 'RUNNING') {
    throw new PreconditionFailedError(
      `Only running workflow runs can be cancelled (current status: ${run.status}).`,
    );
  }

  const updated = await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      status: 'CANCELLED',
      completedAt: new Date(),
      cancelledById: actor.actorId ?? null,
    },
  });

  await recordAudit({
    action: 'workflow-run.cancelled',
    resourceType: 'workflow-run',
    resourceId: runId,
    tenantId: run.tenantId,
    before: { status: run.status },
    after: { status: updated.status },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listTenantWorkflowAssignments(tenantId: string, req: Request) {
  const query = parseListQuery(req);
  const where = { tenantId };
  const [rows, total] = await Promise.all([
    prisma.tenantWorkflowAssignment.findMany({
      where,
      include: {
        template: { select: { id: true, key: true, name: true, status: true, currentVersion: true } },
      },
      orderBy: { createdAt: 'asc' },
      ...paginationArgs(query),
    }),
    prisma.tenantWorkflowAssignment.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function replaceTenantWorkflowAssignments(
  tenantId: string,
  assignments: TenantWorkflowAssignmentEntryInput[],
  actor: ActorContext,
) {
  const unique = new Map<string, { templateId: string; moduleKey: string }>();
  for (const entry of assignments) {
    const moduleKey = entry.moduleKey ?? 'global';
    unique.set(`${entry.templateId}::${moduleKey}`, { templateId: entry.templateId, moduleKey });
  }
  const wanted = Array.from(unique.values());

  const templateIds = Array.from(new Set(wanted.map((entry) => entry.templateId)));
  const templates = templateIds.length
    ? await prisma.workflowTemplate.findMany({
        where: { id: { in: templateIds }, deletedAt: null },
        select: { id: true },
      })
    : [];
  const foundIds = new Set(templates.map((template) => template.id));
  const missing = templateIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new ValidationError(
      'One or more workflow templates could not be found.',
      missing.map((id) => ({ field: 'assignments', message: `Workflow template "${id}" was not found.` })),
    );
  }

  await prisma.$transaction(async (tx) => {
    if (wanted.length === 0) {
      await tx.tenantWorkflowAssignment.deleteMany({ where: { tenantId } });
    } else {
      await tx.tenantWorkflowAssignment.deleteMany({
        where: {
          tenantId,
          NOT: {
            OR: wanted.map(({ templateId, moduleKey }) => ({ templateId, moduleKey })),
          },
        },
      });
    }

    for (const entry of wanted) {
      await tx.tenantWorkflowAssignment.upsert({
        where: {
          tenantId_templateId_moduleKey: {
            tenantId,
            templateId: entry.templateId,
            moduleKey: entry.moduleKey,
          },
        },
        create: {
          tenantId,
          templateId: entry.templateId,
          moduleKey: entry.moduleKey,
          isActive: true,
          assignedById: actor.actorId ?? null,
        },
        update: { isActive: true },
      });
    }
  });

  await recordAudit({
    action: 'tenant.workflow-assignments.updated',
    resourceType: 'tenant-workflow-assignment',
    resourceId: tenantId,
    tenantId,
    metadata: { assignments: wanted },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return prisma.tenantWorkflowAssignment.findMany({
    where: { tenantId },
    include: {
      template: { select: { id: true, key: true, name: true, status: true, currentVersion: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}
