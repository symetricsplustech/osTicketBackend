import type { Request } from 'express';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { createItsmCrudService, assertUnique } from './crud';

export const notificationTemplateService = createItsmCrudService({
  resourceType: 'notification_template',
  label: 'Notification template',
  model: prisma.tenantNotificationTemplate,
  searchFields: ['name', 'eventKey', 'subject'],
  allowedSortFields: ['name', 'eventKey', 'channel', 'status', 'isEnabled', 'createdAt', 'updatedAt'],
  filterFields: ['status', 'channel', 'eventKey', 'isEnabled'],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === 'string' && input.name) {
      await assertUnique(prisma.tenantNotificationTemplate, tenantId, 'name', input.name, 'notification template', existing?.id);
    }
  },
});

export const notificationRuleService = createItsmCrudService({
  resourceType: 'notification_rule',
  label: 'Notification rule',
  model: prisma.tenantNotificationRule,
  statusField: null,
  searchFields: ['name', 'eventKey'],
  allowedSortFields: ['name', 'eventKey', 'channel', 'isEnabled', 'createdAt', 'updatedAt'],
  filterFields: ['channel', 'eventKey', 'isEnabled', 'templateId'],
  include: { template: { select: { id: true, name: true, channel: true } } },
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === 'string' && input.name) {
      await assertUnique(prisma.tenantNotificationRule, tenantId, 'name', input.name, 'notification rule', existing?.id);
    }
  },
});

export const notificationLogService = {
  async list(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 100 });
    const where: Record<string, unknown> = { tenantId };
    if (typeof query.status === 'string' && query.status) where.status = query.status;
    const ruleId = (query as Record<string, unknown>).ruleId;
    if (typeof ruleId === 'string' && ruleId) where.ruleId = ruleId;
    const channel = (query as Record<string, unknown>).channel;
    if (typeof channel === 'string' && channel) where.channel = channel;
    const [rows, total] = await Promise.all([
      prisma.tenantNotificationLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      prisma.tenantNotificationLog.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async get(tenantId: string, id: string) {
    const log = await prisma.tenantNotificationLog.findFirst({ where: { id, tenantId } });
    if (!log) throw new NotFoundError('Notification log');
    return log;
  },
};
