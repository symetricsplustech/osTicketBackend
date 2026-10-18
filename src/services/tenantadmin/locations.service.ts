import { prisma } from '../../config/database';
import { createTenantCrudService } from './structure-crud';

export const locationService = createTenantCrudService({
  resourceType: 'location',
  label: 'Location',
  model: prisma.location,
  codeField: 'code',
  searchFields: ['name', 'code', 'city', 'country'],
  allowedSortFields: ['name', 'code', 'city', 'status', 'createdAt', 'updatedAt'],
});
