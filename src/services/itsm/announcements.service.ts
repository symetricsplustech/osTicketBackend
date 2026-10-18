import { prisma } from '../../config/database';
import { createItsmCrudService } from './crud';
import type { TenantActorContext } from '../tenantadmin/roles.service';

const base = createItsmCrudService({
  resourceType: 'announcement',
  label: 'Announcement',
  model: prisma.announcement,
  searchFields: ['title', 'body'],
  allowedSortFields: ['title', 'status', 'type', 'pinned', 'publishAt', 'expireAt', 'createdAt', 'updatedAt'],
  filterFields: ['status', 'type', 'audience', 'pinned'],
});

export const announcementService = {
  ...base,
  async transition(
    tenantId: string,
    id: string,
    actor: TenantActorContext,
    action: string,
    status: string,
    extra: Record<string, unknown> = {},
  ) {
    const patch: Record<string, unknown> = { ...extra };
    if (status === 'PUBLISHED' && patch.publishAt === undefined) patch.publishAt = new Date();
    return base.transition(tenantId, id, actor, action, status, patch);
  },
};
