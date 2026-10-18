import type { Request } from 'express';
import { Prisma, type BusinessCalendar, type EscalationRule, type SlaPolicy } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError, PreconditionFailedError, ValidationError } from '../../shared/errors';
import { createCrudService } from '../../shared/crud';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import type {
  CreateBusinessCalendarInput,
  CreateEscalationRuleInput,
  CreateSlaPolicyInput,
  UpdateBusinessCalendarInput,
  UpdateEscalationRuleInput,
  UpdateSlaPolicyInput,
} from '../../validators/saasadmin/sla-management.validators';

export interface ActorContext {
  actorId?: string | null;
  req?: Request;
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function jsonValueOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

function parseBooleanFilter(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalised = String(value).toLowerCase();
  if (['true', '1', 'yes'].includes(normalised)) return true;
  if (['false', '0', 'no'].includes(normalised)) return false;
  return undefined;
}

export const slaPolicyCrud = createCrudService<SlaPolicy>({
  model: prisma.slaPolicy as never,
  resourceType: 'sla-policy',
  searchFields: ['key', 'name'],
  filterableFields: ['status'],
  allowedSortFields: ['key', 'name', 'status', 'createdAt', 'updatedAt'],
  defaultOrderBy: { createdAt: 'desc' },
  softDelete: true,
  include: {
    _count: { select: { escalationRules: true, tenantAssignments: true } },
  },
});

export const businessCalendarCrud = createCrudService<BusinessCalendar>({
  model: prisma.businessCalendar as never,
  resourceType: 'business-calendar',
  searchFields: ['name', 'timezone'],
  allowedSortFields: ['name', 'timezone', 'isDefault', 'createdAt', 'updatedAt'],
  defaultOrderBy: { name: 'asc' },
});

export const escalationRuleCrud = createCrudService<EscalationRule>({
  model: prisma.escalationRule as never,
  resourceType: 'escalation-rule',
  searchFields: ['name'],
  filterableFields: ['slaPolicyId'],
  allowedSortFields: ['name', 'thresholdMinutes', 'sortOrder', 'createdAt', 'updatedAt'],
  defaultOrderBy: { sortOrder: 'asc' },
  include: {
    slaPolicy: { select: { id: true, key: true, name: true } },
  },
});

async function assertSlaPolicyExists(slaPolicyId: string | null | undefined): Promise<void> {
  if (slaPolicyId === undefined || slaPolicyId === null) return;
  const policy = await prisma.slaPolicy.findFirst({
    where: { id: slaPolicyId, deletedAt: null },
    select: { id: true },
  });
  if (!policy) throw new NotFoundError('SLA policy');
}

export async function listSlaPolicies(req: Request) {
  return slaPolicyCrud.list(req);
}

export async function createSlaPolicy(input: CreateSlaPolicyInput, actor: ActorContext): Promise<SlaPolicy> {
  const duplicate = await prisma.slaPolicy.findUnique({ where: { key: input.key }, select: { id: true } });
  if (duplicate) throw new ConflictError(`An SLA policy with the key "${input.key}" already exists.`);

  const policy = await prisma.slaPolicy.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      serviceLevels: json(input.serviceLevels),
      settings: jsonValue(input.settings),
      status: 'DRAFT',
    },
  });

  await recordAudit({
    action: 'sla-policy.created',
    resourceType: 'sla-policy',
    resourceId: policy.id,
    after: policy,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return policy;
}

export async function getSlaPolicy(policyId: string) {
  const policy = await prisma.slaPolicy.findFirst({
    where: { id: policyId, deletedAt: null },
    include: {
      escalationRules: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!policy) throw new NotFoundError('SLA policy');
  return policy;
}

export async function updateSlaPolicy(
  policyId: string,
  input: UpdateSlaPolicyInput,
  actor: ActorContext,
): Promise<SlaPolicy> {
  const existing = await slaPolicyCrud.getById(policyId);
  const data: Prisma.SlaPolicyUncheckedUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.serviceLevels !== undefined) data.serviceLevels = json(input.serviceLevels);
  if (input.settings !== undefined) data.settings = jsonValue(input.settings);

  const updated = await prisma.slaPolicy.update({ where: { id: policyId }, data });

  await recordAudit({
    action: 'sla-policy.updated',
    resourceType: 'sla-policy',
    resourceId: policyId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({
    eventKey: 'sla.policy.updated',
    tenantId: null,
    payload: { policyId, key: updated.key },
  });

  return updated;
}

export async function setSlaPolicyStatus(
  policyId: string,
  status: 'ENABLED' | 'DISABLED',
  actor: ActorContext,
): Promise<SlaPolicy> {
  const existing = await slaPolicyCrud.getById(policyId);
  if (existing.status === status) {
    throw new PreconditionFailedError(
      status === 'ENABLED' ? 'This SLA policy is already enabled.' : 'This SLA policy is already disabled.',
    );
  }

  const updated = await prisma.slaPolicy.update({ where: { id: policyId }, data: { status } });

  await recordAudit({
    action: status === 'ENABLED' ? 'sla-policy.enabled' : 'sla-policy.disabled',
    resourceType: 'sla-policy',
    resourceId: policyId,
    before: { status: existing.status },
    after: { status: updated.status },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listBusinessCalendars(req: Request) {
  const query = parseListQuery(req);
  const isDefault = parseBooleanFilter(query['isDefault']);
  return businessCalendarCrud.list(req, isDefault === undefined ? undefined : { isDefault });
}

export async function createBusinessCalendar(
  input: CreateBusinessCalendarInput,
  actor: ActorContext,
): Promise<BusinessCalendar> {
  const calendar = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.businessCalendar.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.businessCalendar.create({
      data: {
        name: input.name,
        timezone: input.timezone,
        workingHours: json(input.workingHours),
        holidays: jsonValue(input.holidays),
        isDefault: input.isDefault,
      },
    });
  });

  await recordAudit({
    action: 'business-calendar.created',
    resourceType: 'business-calendar',
    resourceId: calendar.id,
    after: calendar,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return calendar;
}

export async function updateBusinessCalendar(
  calendarId: string,
  input: UpdateBusinessCalendarInput,
  actor: ActorContext,
): Promise<BusinessCalendar> {
  const existing = await prisma.businessCalendar.findUnique({ where: { id: calendarId } });
  if (!existing) throw new NotFoundError('Business calendar');

  const data: Prisma.BusinessCalendarUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.workingHours !== undefined) data.workingHours = json(input.workingHours);
  if (input.holidays !== undefined) data.holidays = jsonValueOrNull(input.holidays);
  if (input.isDefault !== undefined) data.isDefault = input.isDefault;

  const calendar = await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.businessCalendar.updateMany({
        where: { isDefault: true, id: { not: calendarId } },
        data: { isDefault: false },
      });
    }
    return tx.businessCalendar.update({ where: { id: calendarId }, data });
  });

  await recordAudit({
    action: 'business-calendar.updated',
    resourceType: 'business-calendar',
    resourceId: calendarId,
    before: existing,
    after: calendar,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return calendar;
}

export async function listEscalationRules(req: Request) {
  const query = parseListQuery(req);
  const isEnabled = parseBooleanFilter(query['isEnabled']);
  return escalationRuleCrud.list(req, isEnabled === undefined ? undefined : { isEnabled });
}

export async function createEscalationRule(
  input: CreateEscalationRuleInput,
  actor: ActorContext,
): Promise<EscalationRule> {
  await assertSlaPolicyExists(input.slaPolicyId);

  const rule = await prisma.escalationRule.create({
    data: {
      name: input.name,
      slaPolicyId: input.slaPolicyId ?? null,
      trigger: input.trigger,
      thresholdMinutes: input.thresholdMinutes,
      actions: json(input.actions),
      isEnabled: input.isEnabled,
      sortOrder: input.sortOrder,
    },
  });

  await recordAudit({
    action: 'escalation-rule.created',
    resourceType: 'escalation-rule',
    resourceId: rule.id,
    after: rule,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return rule;
}

export async function updateEscalationRule(
  ruleId: string,
  input: UpdateEscalationRuleInput,
  actor: ActorContext,
): Promise<EscalationRule> {
  const existing = await prisma.escalationRule.findUnique({ where: { id: ruleId } });
  if (!existing) throw new NotFoundError('Escalation rule');
  await assertSlaPolicyExists(input.slaPolicyId);

  const data: Prisma.EscalationRuleUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.slaPolicyId !== undefined) data.slaPolicyId = input.slaPolicyId;
  if (input.trigger !== undefined) data.trigger = input.trigger;
  if (input.thresholdMinutes !== undefined) data.thresholdMinutes = input.thresholdMinutes;
  if (input.actions !== undefined) data.actions = json(input.actions);
  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  const updated = await prisma.escalationRule.update({ where: { id: ruleId }, data });

  await recordAudit({
    action: 'escalation-rule.updated',
    resourceType: 'escalation-rule',
    resourceId: ruleId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listTenantSlaAssignments(tenantId: string, req: Request) {
  const query = parseListQuery(req);
  const where = { tenantId };
  const [rows, total] = await Promise.all([
    prisma.tenantSlaAssignment.findMany({
      where,
      include: { slaPolicy: { select: { id: true, key: true, name: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      ...paginationArgs(query),
    }),
    prisma.tenantSlaAssignment.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function replaceTenantSlaAssignments(tenantId: string, slaPolicyIds: string[], actor: ActorContext) {
  const uniqueIds = Array.from(new Set(slaPolicyIds));
  const policies = uniqueIds.length
    ? await prisma.slaPolicy.findMany({
        where: { id: { in: uniqueIds }, deletedAt: null },
        select: { id: true },
      })
    : [];
  const foundIds = new Set(policies.map((policy) => policy.id));
  const missing = uniqueIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new ValidationError(
      'One or more SLA policies could not be found.',
      missing.map((id) => ({ field: 'slaPolicyIds', message: `SLA policy "${id}" was not found.` })),
    );
  }

  await prisma.$transaction([
    prisma.tenantSlaAssignment.deleteMany({ where: { tenantId, slaPolicyId: { notIn: uniqueIds } } }),
    ...uniqueIds.map((slaPolicyId) =>
      prisma.tenantSlaAssignment.upsert({
        where: { tenantId_slaPolicyId: { tenantId, slaPolicyId } },
        create: { tenantId, slaPolicyId, isActive: true, assignedById: actor.actorId ?? null },
        update: { isActive: true },
      }),
    ),
  ]);

  await recordAudit({
    action: 'tenant.sla-assignments.updated',
    resourceType: 'tenant-sla-assignment',
    resourceId: tenantId,
    tenantId,
    metadata: { slaPolicyIds: uniqueIds },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return prisma.tenantSlaAssignment.findMany({
    where: { tenantId },
    include: { slaPolicy: { select: { id: true, key: true, name: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  });
}
