import { prisma } from '../../config/database';
import { createItsmCrudService, assertUnique } from './crud';

export const vendorService = createItsmCrudService({
  resourceType: 'vendor',
  label: 'Vendor',
  model: prisma.vendor,
  searchFields: ['name', 'code', 'email', 'contactName', 'city', 'country'],
  allowedSortFields: ['name', 'code', 'status', 'type', 'rating', 'createdAt', 'updatedAt'],
  filterFields: ['status', 'type'],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === 'string' && input.name) {
      await assertUnique(prisma.vendor, tenantId, 'name', input.name, 'vendor', existing?.id);
    }
    if (typeof input.code === 'string' && input.code) {
      await assertUnique(prisma.vendor, tenantId, 'code', input.code, 'vendor code', existing?.id);
    }
  },
});
