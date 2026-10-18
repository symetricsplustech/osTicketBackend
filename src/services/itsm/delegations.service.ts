import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import { createItsmCrudService } from './crud';
import type { TenantActorContext } from '../tenantadmin/roles.service';

const delegationBase = createItsmCrudService({
  resourceType: 'delegation',
  label: 'Delegation',
  model: prisma.tenantDelegation,
  searchFields: ['reason'],
  allowedSortFields: ['startsAt', 'endsAt', 'status', 'createdAt', 'updatedAt'],
  filterFields: ['status', 'delegatorId', 'delegateeId'],
});

export const delegationService = {
  ...delegationBase,
  async revoke(tenantId: string, id: string, actor: TenantActorContext) {
    const delegation = await prisma.tenantDelegation.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!delegation) throw new NotFoundError('Delegation');
    return delegationBase.transition(tenantId, id, actor, 'revoked', 'REVOKED', { revokedAt: new Date() });
  },
};
