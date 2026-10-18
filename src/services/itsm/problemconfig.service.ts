import { prisma } from '../../config/database';
import { createItsmCrudService, assertUnique } from './crud';

export const problemCategoryService = createItsmCrudService({
  resourceType: 'problem_category',
  label: 'Problem category',
  model: prisma.tenantProblemCategory,
  statusField: null,
  searchFields: ['name', 'code', 'description'],
  allowedSortFields: ['name', 'code', 'createdAt', 'updatedAt'],
  validate: async (tenantId, input, existing) => {
    if (typeof input.code === 'string' && input.code) {
      await assertUnique(prisma.tenantProblemCategory, tenantId, 'code', input.code, 'problem category', existing?.id);
    }
  },
});

export const rootCauseCategoryService = createItsmCrudService({
  resourceType: 'root_cause_category',
  label: 'Root cause category',
  model: prisma.tenantRootCauseCategory,
  statusField: null,
  searchFields: ['name', 'code', 'description'],
  allowedSortFields: ['name', 'code', 'createdAt', 'updatedAt'],
  validate: async (tenantId, input, existing) => {
    if (typeof input.code === 'string' && input.code) {
      await assertUnique(prisma.tenantRootCauseCategory, tenantId, 'code', input.code, 'root cause category', existing?.id);
    }
  },
});
