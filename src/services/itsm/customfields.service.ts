import { prisma } from '../../config/database';
import { ConflictError } from '../../shared/errors';
import { createItsmCrudService } from './crud';

export const customFieldService = createItsmCrudService({
  resourceType: 'custom_field',
  label: 'Custom field',
  model: prisma.tenantCustomField,
  statusField: null,
  searchFields: ['key', 'label', 'resourceType'],
  allowedSortFields: ['key', 'label', 'resourceType', 'sortOrder', 'createdAt', 'updatedAt'],
  defaultOrderBy: { sortOrder: 'asc' },
  filterFields: ['resourceType'],
  validate: async (tenantId, input, existing) => {
    if (typeof input.key === 'string' && input.key && typeof input.resourceType === 'string' && input.resourceType) {
      const dup = await prisma.tenantCustomField.findFirst({
        where: { tenantId, resourceType: input.resourceType, key: input.key, ...(existing ? { id: { not: existing.id } } : {}) },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictError('A custom field with this key already exists for the resource type.');
      }
    }
  },
});
