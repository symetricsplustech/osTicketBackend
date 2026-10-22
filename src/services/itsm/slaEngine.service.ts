import { prisma } from "../../config/database";
import { NotFoundError, ValidationError } from "../../shared/errors";
import { recordAudit } from "../../shared/audit";
import { publishEvent } from "../../shared/events";
import type { TenantActorContext } from "../tenantadmin/roles.service";

interface SlaServiceLevel {
  priority: string;
  responseMinutes?: number | null;
  resolutionMinutes?: number | null;
}

/**
 * Resolves the tenant's active SLA policy and returns the service level
 * matching the ticket's priority, plus the default business calendar.
 */
async function resolveSlaForTicket(
  tenantId: string,
  priorityKey: string,
): Promise<{
  policy: { id: string; name: string; serviceLevels: SlaServiceLevel[] } | null;
  calendarId: string | null;
  level: SlaServiceLevel | null;
}> {
  const assignment = await prisma.tenantSlaAssignment.findFirst({
    where: { tenantId, isActive: true },
    include: {
      slaPolicy: {
        select: { id: true, name: true, serviceLevels: true, settings: true },
      },
    },
  });
  if (!assignment || !assignment.slaPolicy) {
    return { policy: null, calendarId: null, level: null };
  }
  const serviceLevels: SlaServiceLevel[] =
    (assignment.slaPolicy.serviceLevels as unknown as Record<string, unknown>[])?.map((l: Record<string, unknown>) => ({
      priority: l.priority as string,
      responseMinutes: l.responseMinutes as number | null | undefined,
      resolutionMinutes: l.resolutionMinutes as number | null | undefined,
    })) ?? [];
  const level = serviceLevels.find((l) => l.priority === priorityKey) ?? null;
  const settings = (assignment.slaPolicy.settings as Record<string, unknown> | null) ?? {};
  return {
    policy: {
      id: assignment.slaPolicy.id,
      name: assignment.slaPolicy.name,
      serviceLevels,
    },
    calendarId: (settings.calendarId as string | null) ?? null,
    level,
  };
}

/**
 * Creates SLA instances (response + resolution) for a newly created incident,
 * starts the response clock, and records a START clock event.
 */
export async function createSlaInstancesForIncident(
  tenantId: string,
  incidentId: string,
  priorityKey: string,
  actor: TenantActorContext,
) {
  const { policy, calendarId, level } = await resolveSlaForTicket(
    tenantId,
    priorityKey,
  );
  if (!level) return null;

  const now = new Date();
  const responseDeadline = level.responseMinutes
    ? new Date(now.getTime() + level.responseMinutes * 60 * 1000)
    : null;
  const resolutionDeadline = level.resolutionMinutes
    ? new Date(now.getTime() + level.resolutionMinutes * 60 * 1000)
    : null;

  const instances = await prisma.$transaction(async (tx) => {
    const responseInstance = await tx.ticketSlaInstance.create({
      data: {
        tenantId,
        incidentId,
        milestone: "response",
        priorityKey,
        targetMinutes: level.responseMinutes ?? 0,
        startedAt: now,
        deadlineAt: responseDeadline,
        status: "RUNNING",
        policyKey: policy?.id ?? null,
        metadata: {
          calendarId,
          policyName: policy?.name ?? null,
          source: "incident_created",
        },
      },
    });
    const resolutionInstance = await tx.ticketSlaInstance.create({
      data: {
        tenantId,
        incidentId,
        milestone: "resolution",
        priorityKey,
        targetMinutes: level.resolutionMinutes ?? 0,
        startedAt: now,
        deadlineAt: resolutionDeadline,
        status: "RUNNING",
        policyKey: policy?.id ?? null,
        metadata: {
          calendarId,
          policyName: policy?.name ?? null,
          source: "incident_created",
        },
      },
    });
    await tx.slaClockEvent.create({
      data: {
        tenantId,
        slaInstanceId: responseInstance.id,
        type: "START",
        actorId: actor.actorId ?? null,
        reason: "SLA clock started on incident creation",
      },
    });
    await tx.slaClockEvent.create({
      data: {
        tenantId,
        slaInstanceId: resolutionInstance.id,
        type: "START",
        actorId: actor.actorId ?? null,
        reason: "SLA clock started on incident creation",
      },
    });
    return { responseInstance, resolutionInstance };
  });

  await recordAudit({
    action: "incident.sla.started",
    resourceType: "incident",
    resourceId: incidentId,
    tenantId,
    after: {
      responseDeadline: instances.responseInstance.deadlineAt,
      resolutionDeadline: instances.resolutionInstance.deadlineAt,
      policy: policy?.name,
    },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "incident.sla.started",
    tenantId,
    payload: {
      incidentId,
      responseDeadline: instances.responseInstance.deadlineAt,
      resolutionDeadline: instances.resolutionInstance.deadlineAt,
    },
  });

  return instances;
}

/**
 * Completes (stops) the response SLA clock for an incident when the first
 * qualifying human response is recorded.
 */
export async function completeResponseSla(
  tenantId: string,
  incidentId: string,
  actor: TenantActorContext,
) {
  const instance = await prisma.ticketSlaInstance.findFirst({
    where: { tenantId, incidentId, milestone: "response", status: "RUNNING" },
  });
  if (!instance) throw new NotFoundError("Running response SLA instance");

  const now = new Date();
  const updated = await prisma.ticketSlaInstance.update({
    where: { id: instance.id },
    data: {
      status: "MET",
      completedAt: now,
    },
  });
  await prisma.slaClockEvent.create({
    data: {
      tenantId,
      slaInstanceId: instance.id,
      type: "COMPLETE",
      actorId: actor.actorId ?? null,
      reason: "First qualifying response recorded",
    },
  });

  await recordAudit({
    action: "incident.sla.response.met",
    resourceType: "incident",
    resourceId: incidentId,
    tenantId,
    before: { deadlineAt: instance.deadlineAt },
    after: { completedAt: now, metWithinTarget: now <= (instance.deadlineAt ?? now) },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });

  return updated;
}

/**
 * Detects SLA instances whose deadline has passed without completion and
 * marks them breached, recording a BREACH clock event.
 */
export async function detectSlaBreaches(
  tenantId: string,
  actor: TenantActorContext,
) {
  const now = new Date();
  const overdue = await prisma.ticketSlaInstance.findMany({
    where: {
      tenantId,
      status: "RUNNING",
      deadlineAt: { lt: now },
    },
    include: { incident: { select: { id: true, number: true, title: true } } },
  });

  const breached: Record<string, unknown>[] = [];
  for (const instance of overdue) {
    const updated = await prisma.ticketSlaInstance.update({
      where: { id: instance.id },
      data: {
        status: "BREACHED",
        breached: true,
        breachedAt: now,
      },
    });
    await prisma.slaClockEvent.create({
      data: {
        tenantId,
        slaInstanceId: instance.id,
        type: "BREACH",
        actorId: actor.actorId ?? null,
        reason: `SLA deadline exceeded for ${instance.milestone} milestone`,
      },
    });
    await recordAudit({
      action: "incident.sla.breached",
      resourceType: "incident",
      resourceId: instance.incidentId ?? "",
      tenantId,
      before: { milestone: instance.milestone, deadlineAt: instance.deadlineAt },
      after: { status: "BREACHED", breachedAt: now },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    breached.push(updated);
  }

  void publishEvent({
    eventKey: "sla.breach.detected",
    tenantId,
    payload: { count: breached.length, breached },
  });

  return breached;
}

/**
 * Pauses an SLA clock for a permitted reason (e.g. waiting for customer).
 */
export async function pauseSlaClock(
  tenantId: string,
  incidentId: string,
  milestone: string,
  reason: string,
  actor: TenantActorContext,
) {
  const instance = await prisma.ticketSlaInstance.findFirst({
    where: { tenantId, incidentId, milestone, status: "RUNNING" },
  });
  if (!instance) throw new NotFoundError("Running SLA instance");

  const now = new Date();
  const updated = await prisma.ticketSlaInstance.update({
    where: { id: instance.id },
    data: { status: "PAUSED", pausedAt: now },
  });
  await prisma.slaClockEvent.create({
    data: {
      tenantId,
      slaInstanceId: instance.id,
      type: "PAUSE",
      actorId: actor.actorId ?? null,
      reason,
    },
  });
  await recordAudit({
    action: "incident.sla.paused",
    resourceType: "incident",
    resourceId: incidentId,
    tenantId,
    before: { status: "RUNNING" },
    after: { status: "PAUSED", pausedAt: now, reason },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  return updated;
}

/**
 * Resumes a paused SLA clock.
 */
export async function resumeSlaClock(
  tenantId: string,
  incidentId: string,
  milestone: string,
  reason: string,
  actor: TenantActorContext,
) {
  const instance = await prisma.ticketSlaInstance.findFirst({
    where: { tenantId, incidentId, milestone, status: "PAUSED" },
  });
  if (!instance) throw new NotFoundError("Paused SLA instance");

  const now = new Date();
  const pausedMinutes = instance.pausedAt
    ? Math.floor((now.getTime() - instance.pausedAt.getTime()) / 60000)
    : 0;

  const updated = await prisma.ticketSlaInstance.update({
    where: { id: instance.id },
    data: {
      status: "RUNNING",
      pausedAt: null,
      pausedDuration: { increment: pausedMinutes },
    },
  });
  await prisma.slaClockEvent.create({
    data: {
      tenantId,
      slaInstanceId: instance.id,
      type: "RESUME",
      actorId: actor.actorId ?? null,
      reason,
      pausedMinutes,
    },
  });
  await recordAudit({
    action: "incident.sla.resumed",
    resourceType: "incident",
    resourceId: incidentId,
    tenantId,
    before: { status: "PAUSED" },
    after: { status: "RUNNING", pausedMinutes },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  return updated;
}

/**
 * Lists SLA instances for a tenant, optionally filtered by incident and status.
 */
export async function listSlaInstances(
  tenantId: string,
  filters?: { incidentId?: string; milestone?: string; status?: string },
) {
  const where: Record<string, unknown> = { tenantId };
  if (filters?.incidentId) where.incidentId = filters.incidentId;
  if (filters?.milestone) where.milestone = filters.milestone;
  if (filters?.status) where.status = filters.status;

  return prisma.ticketSlaInstance.findMany({
    where,
    include: {
      incident: { select: { id: true, number: true, title: true, statusKey: true } },
      slaPolicy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Lists clock events for a tenant, optionally filtered by instance.
 */
export async function listSlaClockEvents(
  tenantId: string,
  filters?: { slaInstanceId?: string; type?: string },
) {
  const where: Record<string, unknown> = { tenantId };
  if (filters?.slaInstanceId) where.slaInstanceId = filters.slaInstanceId;
  if (filters?.type) where.type = filters.type;

  return prisma.slaClockEvent.findMany({
    where,
    include: {
      actor: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { occurredAt: "desc" },
  });
}

export type { SlaServiceLevel };
