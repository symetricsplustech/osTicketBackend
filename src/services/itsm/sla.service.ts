import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import { createItsmCrudService, assertUnique } from './crud';

export const slaPolicyService = createItsmCrudService({
  resourceType: 'sla_policy',
  label: 'SLA policy',
  model: prisma.tenantSlaPolicy,
  searchFields: ['name', 'description'],
  allowedSortFields: ['name', 'status', 'isDefault', 'createdAt', 'updatedAt'],
  filterFields: ['status'],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === 'string' && input.name) {
      await assertUnique(prisma.tenantSlaPolicy, tenantId, 'name', input.name, 'SLA policy', existing?.id);
    }
  },
});

export const escalationRuleService = createItsmCrudService({
  resourceType: 'sla_escalation_rule',
  label: 'Escalation rule',
  model: prisma.tenantSlaEscalationRule,
  statusField: null,
  setCreatedBy: false,
  softDelete: false,
  searchFields: ['name', 'trigger'],
  allowedSortFields: ['name', 'trigger', 'thresholdMinutes', 'isEnabled', 'sortOrder', 'createdAt', 'updatedAt'],
  filterFields: ['slaPolicyId', 'isEnabled'],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === 'string' && input.name) {
      await assertUnique(prisma.tenantSlaEscalationRule, tenantId, 'name', input.name, 'escalation rule', existing?.id);
    }
  },
});

const calendarBase = createItsmCrudService({
  resourceType: 'business_calendar',
  label: 'Business calendar',
  model: prisma.tenantBusinessCalendar,
  setCreatedBy: false,
  searchFields: ['name', 'timezone'],
  allowedSortFields: ['name', 'timezone', 'isDefault', 'createdAt', 'updatedAt'],
  filterFields: ['timezone'],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === 'string' && input.name) {
      await assertUnique(prisma.tenantBusinessCalendar, tenantId, 'name', input.name, 'business calendar', existing?.id);
    }
  },
});

export const businessCalendarService = {
  ...calendarBase,
  async setDefault(tenantId: string, id: string) {
    const calendar = await prisma.tenantBusinessCalendar.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!calendar) throw new NotFoundError('Business calendar');
    await prisma.$transaction([
      prisma.tenantBusinessCalendar.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } }),
      prisma.tenantBusinessCalendar.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return prisma.tenantBusinessCalendar.findUniqueOrThrow({ where: { id } });
  },
};
