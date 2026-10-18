import type { AuditOutcome, LoginOutcome, Prisma, SecuritySeverity } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { clientIp, userAgent } from '../utils/sanitize-request';
import { redactObject, truncate } from '../utils/sanitize';

export interface AuditInput {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  tenantId?: string | null;
  outcome?: AuditOutcome;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  actorEmail?: string | null;
  actorType?: string;
  req?: Request;
}

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return redactObject(value) as Prisma.InputJsonValue;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const req = input.req;
    await prisma.auditEvent.create({
      data: {
        actorId: input.actorId ?? req?.auth?.userId ?? null,
        actorEmail: input.actorEmail ?? req?.auth?.email ?? null,
        actorType: input.actorType ?? 'PLATFORM_STAFF',
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        tenantId: input.tenantId ?? null,
        outcome: input.outcome ?? 'SUCCESS',
        before: jsonValue(input.before),
        after: jsonValue(input.after),
        metadata: input.metadata ? (redactObject(input.metadata) as Prisma.InputJsonValue) : undefined,
        ipAddress: req ? clientIp(req) : null,
        userAgent: req ? userAgent(req) : null,
        requestId: req?.requestId ?? null,
      },
    });
  } catch (error) {
    logger.error({ error, action: input.action }, 'Failed to record audit event');
  }
}

export interface SecurityEventInput {
  eventType: string;
  severity?: SecuritySeverity;
  userId?: string | null;
  tenantId?: string | null;
  details?: Record<string, unknown>;
  req?: Request;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    const req = input.req;
    await prisma.securityEvent.create({
      data: {
        eventType: input.eventType,
        severity: input.severity ?? 'INFO',
        userId: input.userId ?? req?.auth?.userId ?? null,
        tenantId: input.tenantId ?? null,
        ipAddress: input.ipAddress ?? (req ? clientIp(req) : null),
        userAgent: input.userAgent ?? (req ? userAgent(req) : null),
        details: input.details ? (redactObject(input.details) as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (error) {
    logger.error({ error, eventType: input.eventType }, 'Failed to record security event');
  }
}

export interface LoginEventInput {
  email: string;
  outcome: LoginOutcome;
  userId?: string | null;
  failureReason?: string | null;
  req?: Request;
}

export async function recordLoginEvent(input: LoginEventInput): Promise<void> {
  try {
    await prisma.loginEvent.create({
      data: {
        userId: input.userId ?? null,
        email: input.email,
        outcome: input.outcome,
        failureReason: input.failureReason ?? null,
        ipAddress: input.req ? clientIp(input.req) : null,
        userAgent: input.req ? userAgent(input.req) : null,
      },
    });
  } catch (error) {
    logger.error({ error, email: input.email }, 'Failed to record login event');
  }
}

export interface ResourceHistoryEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  outcome: string;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: Date;
}

export async function getResourceHistory(
  resourceType: string,
  resourceId: string,
  limit = 50,
): Promise<ResourceHistoryEntry[]> {
  const events = await prisma.auditEvent.findMany({
    where: { resourceType, resourceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return events.map((event) => ({
    id: event.id,
    action: event.action,
    actorEmail: event.actorEmail,
    outcome: event.outcome,
    before: event.before,
    after: event.after,
    metadata: event.metadata,
    createdAt: event.createdAt,
  }));
}

export function summarizeDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const key of keys) {
    const from = before?.[key];
    const to = after?.[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      diff[key] = { from, to };
    }
  }
  return diff;
}

export function sanitizeErrorForAudit(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return truncate(message, 500);
}
