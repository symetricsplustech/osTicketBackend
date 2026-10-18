import type { Request } from 'express';
import { Prisma, type AccessPolicy, type AccessPolicySubjectType } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError, ValidationError, type ErrorDetail } from '../../shared/errors';
import { createCrudService } from '../../shared/crud';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import {
  validateRulesForPolicyType,
  type CreateAccessPolicyAssignmentInput,
  type CreateAccessPolicyInput,
  type UpdateAccessPolicyInput,
} from '../../validators/saasadmin/access-policies.validators';

export interface ActorContext {
  actorId?: string | null;
  req?: Request;
}

export const ACCESS_POLICY_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
} as const;

export const accessPolicyCrud = createCrudService<AccessPolicy>({
  model: prisma.accessPolicy as never,
  resourceType: 'access-policy',
  searchFields: ['name', 'policyType'],
  filterableFields: ['policyType'],
  allowedSortFields: ['name', 'policyType', 'priority', 'createdAt', 'updatedAt'],
  defaultOrderBy: { priority: 'asc' },
  softDelete: true,
});

function parseBooleanFilter(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalised = String(value).toLowerCase();
  if (['true', '1', 'yes'].includes(normalised)) return true;
  if (['false', '0', 'no'].includes(normalised)) return false;
  return undefined;
}

async function hydrateAssignments<T extends { subjectType: AccessPolicySubjectType; subjectId: string }>(
  assignments: T[],
) {
  const roleIds = Array.from(
    new Set(assignments.filter((assignment) => assignment.subjectType === 'ROLE').map((assignment) => assignment.subjectId)),
  );
  const roles = roleIds.length
    ? await prisma.platformRole.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, key: true, name: true },
      })
    : [];
  const roleById = new Map(roles.map((role) => [role.id, role]));

  return assignments.map((assignment) => ({
    ...assignment,
    role: assignment.subjectType === 'ROLE' ? roleById.get(assignment.subjectId) ?? null : null,
  }));
}

function assertRulesValid(policyType: string, rules: Record<string, unknown>): void {
  const issues = validateRulesForPolicyType(policyType, rules);
  if (issues.length > 0) {
    const details: ErrorDetail[] = issues.map((message) => ({ field: 'rules', message }));
    throw new ValidationError(`The rules are not valid for a ${policyType} policy.`, details);
  }
}

async function assertNoEnabledConflict(policyType: string, priority: number, excludeId?: string): Promise<void> {
  const conflict = await prisma.accessPolicy.findFirst({
    where: {
      policyType,
      priority,
      isEnabled: true,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true },
  });
  if (conflict) {
    throw new ConflictError(
      `An enabled ${policyType} policy with priority ${priority} already exists ("${conflict.name}").`,
    );
  }
}

export async function listAccessPolicies(req: Request) {
  const query = parseListQuery(req);
  const isEnabled = parseBooleanFilter(query['isEnabled']);
  return accessPolicyCrud.list(req, isEnabled === undefined ? undefined : { isEnabled });
}

export async function createAccessPolicy(input: CreateAccessPolicyInput, actor: ActorContext): Promise<AccessPolicy> {
  assertRulesValid(input.policyType, input.rules);
  if (input.isEnabled) {
    await assertNoEnabledConflict(input.policyType, input.priority);
  }

  const policy = await prisma.accessPolicy.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      policyType: input.policyType,
      rules: input.rules as unknown as Prisma.InputJsonValue,
      priority: input.priority,
      isEnabled: input.isEnabled,
      createdById: actor.actorId ?? null,
    },
  });

  await recordAudit({
    action: 'access-policy.created',
    resourceType: 'access-policy',
    resourceId: policy.id,
    after: policy,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return policy;
}

export async function getAccessPolicy(policyId: string) {
  const policy = await prisma.accessPolicy.findFirst({
    where: { id: policyId, deletedAt: null },
    include: {
      assignments: {
        include: { user: { select: ACCESS_POLICY_USER_SELECT } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!policy) throw new NotFoundError('Access policy');

  const assignments = await hydrateAssignments(policy.assignments);
  return { ...policy, assignments, assignmentCount: assignments.length };
}

export async function updateAccessPolicy(
  policyId: string,
  input: UpdateAccessPolicyInput,
  actor: ActorContext,
): Promise<AccessPolicy> {
  const existing = await accessPolicyCrud.getById(policyId);
  const data: Prisma.AccessPolicyUncheckedUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.rules !== undefined) {
    assertRulesValid(existing.policyType, input.rules);
    data.rules = input.rules as unknown as Prisma.InputJsonValue;
  }
  if (input.priority !== undefined) {
    data.priority = input.priority;
    if (existing.isEnabled) {
      await assertNoEnabledConflict(existing.policyType, input.priority, policyId);
    }
  }

  const updated = await prisma.accessPolicy.update({ where: { id: policyId }, data });

  await recordAudit({
    action: 'access-policy.updated',
    resourceType: 'access-policy',
    resourceId: policyId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function setAccessPolicyEnabled(
  policyId: string,
  isEnabled: boolean,
  actor: ActorContext,
): Promise<AccessPolicy> {
  const existing = await accessPolicyCrud.getById(policyId);
  if (isEnabled && !existing.isEnabled) {
    await assertNoEnabledConflict(existing.policyType, existing.priority, policyId);
  }

  const updated = await prisma.accessPolicy.update({ where: { id: policyId }, data: { isEnabled } });

  await recordAudit({
    action: isEnabled ? 'access-policy.enabled' : 'access-policy.disabled',
    resourceType: 'access-policy',
    resourceId: policyId,
    before: { isEnabled: existing.isEnabled },
    after: { isEnabled: updated.isEnabled },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listAccessPolicyAssignments(policyId: string, req: Request) {
  const policy = await prisma.accessPolicy.findFirst({
    where: { id: policyId, deletedAt: null },
    select: { id: true },
  });
  if (!policy) throw new NotFoundError('Access policy');

  const query = parseListQuery(req);
  const where = { policyId };
  const [rows, total] = await Promise.all([
    prisma.accessPolicyAssignment.findMany({
      where,
      include: { user: { select: ACCESS_POLICY_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
      ...paginationArgs(query),
    }),
    prisma.accessPolicyAssignment.count({ where }),
  ]);

  const assignments = await hydrateAssignments(rows);
  return { rows: assignments, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function createAccessPolicyAssignment(
  policyId: string,
  input: CreateAccessPolicyAssignmentInput,
  actor: ActorContext,
) {
  const policy = await prisma.accessPolicy.findFirst({
    where: { id: policyId, deletedAt: null },
    select: { id: true },
  });
  if (!policy) throw new NotFoundError('Access policy');

  if (input.subjectType === 'USER') {
    const user = await prisma.user.findFirst({ where: { id: input.subjectId }, select: { id: true } });
    if (!user) throw new NotFoundError('User');
  } else {
    const role = await prisma.platformRole.findFirst({
      where: { id: input.subjectId, deletedAt: null },
      select: { id: true },
    });
    if (!role) throw new NotFoundError('Platform role');
  }

  const alreadyAssigned = await prisma.accessPolicyAssignment.findUnique({
    where: {
      policyId_subjectType_subjectId: {
        policyId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      },
    },
  });
  if (alreadyAssigned) throw new ConflictError('This subject is already assigned to the policy.');

  const assignment = await prisma.accessPolicyAssignment.create({
    data: { policyId, subjectType: input.subjectType, subjectId: input.subjectId },
    include: { user: { select: ACCESS_POLICY_USER_SELECT } },
  });

  await recordAudit({
    action: 'access-policy.assignment.created',
    resourceType: 'access-policy',
    resourceId: policyId,
    after: assignment,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  const [hydrated] = await hydrateAssignments([assignment]);
  return hydrated;
}

export async function deleteAccessPolicyAssignment(
  policyId: string,
  assignmentId: string,
  actor: ActorContext,
): Promise<void> {
  const assignment = await prisma.accessPolicyAssignment.findFirst({
    where: { id: assignmentId, policyId },
  });
  if (!assignment) throw new NotFoundError('Policy assignment');

  await prisma.accessPolicyAssignment.delete({ where: { id: assignmentId } });

  await recordAudit({
    action: 'access-policy.assignment.removed',
    resourceType: 'access-policy',
    resourceId: policyId,
    before: assignment,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
}
