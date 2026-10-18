import type { Request } from 'express';
import { Prisma, type ServiceCategory, type ServiceDefinition, type ServiceTemplate } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError, PreconditionFailedError, ValidationError } from '../../shared/errors';
import { createCrudService } from '../../shared/crud';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import type {
  CreateServiceCategoryInput,
  CreateServiceDefinitionInput,
  CreateServiceTemplateInput,
  UpdateServiceCategoryInput,
  UpdateServiceDefinitionInput,
  UpdateServiceTemplateInput,
} from '../../validators/saasadmin/service-management.validators';

export interface ActorContext {
  actorId?: string | null;
  req?: Request;
}

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function jsonValueOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0;
}

export const serviceDefinitionCrud = createCrudService<ServiceDefinition>({
  model: prisma.serviceDefinition as never,
  resourceType: 'service-definition',
  searchFields: ['key', 'name'],
  filterableFields: ['status', 'categoryId'],
  allowedSortFields: ['key', 'name', 'status', 'createdAt', 'updatedAt'],
  defaultOrderBy: { createdAt: 'desc' },
  softDelete: true,
  include: {
    category: { select: { id: true, name: true } },
    _count: { select: { templates: true, tenantAssignments: true } },
  },
});

export const serviceCategoryCrud = createCrudService<ServiceCategory>({
  model: prisma.serviceCategory as never,
  resourceType: 'service-category',
  searchFields: ['name'],
  allowedSortFields: ['name', 'sortOrder', 'createdAt', 'updatedAt'],
  defaultOrderBy: { sortOrder: 'asc' },
  include: {
    parent: { select: { id: true, name: true } },
    _count: { select: { services: true, children: true } },
  },
});

export const serviceTemplateCrud = createCrudService<ServiceTemplate>({
  model: prisma.serviceTemplate as never,
  resourceType: 'service-template',
  searchFields: ['key', 'name'],
  filterableFields: ['status', 'serviceId'],
  allowedSortFields: ['key', 'name', 'status', 'currentVersion', 'createdAt', 'updatedAt'],
  defaultOrderBy: { createdAt: 'desc' },
  softDelete: true,
  include: {
    service: { select: { id: true, key: true, name: true } },
    _count: { select: { versions: true } },
  },
});

async function assertCategoryExists(categoryId: string | null | undefined): Promise<void> {
  if (categoryId === undefined || categoryId === null) return;
  const category = await prisma.serviceCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) throw new NotFoundError('Service category');
}

async function assertServiceExists(serviceId: string | null | undefined): Promise<void> {
  if (serviceId === undefined || serviceId === null) return;
  const service = await prisma.serviceDefinition.findFirst({
    where: { id: serviceId, deletedAt: null },
    select: { id: true },
  });
  if (!service) throw new NotFoundError('Service definition');
}

async function assertCategoryHierarchy(categoryId: string, parentId: string): Promise<void> {
  if (parentId === categoryId) {
    throw new PreconditionFailedError('A category cannot be its own parent.');
  }
  const parent = await prisma.serviceCategory.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true },
  });
  if (!parent) throw new NotFoundError('Service category');

  let currentId: string | null = parent.parentId;
  const visited = new Set<string>([parentId]);
  while (currentId) {
    if (currentId === categoryId) {
      throw new PreconditionFailedError('The selected parent would create a circular category hierarchy.');
    }
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const node: { parentId: string | null } | null = await prisma.serviceCategory.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = node?.parentId ?? null;
  }
}

export async function listServices(req: Request) {
  return serviceDefinitionCrud.list(req);
}

export async function createService(input: CreateServiceDefinitionInput, actor: ActorContext): Promise<ServiceDefinition> {
  const duplicate = await prisma.serviceDefinition.findUnique({ where: { key: input.key }, select: { id: true } });
  if (duplicate) throw new ConflictError(`A service with the key "${input.key}" already exists.`);
  await assertCategoryExists(input.categoryId);

  const service = await prisma.serviceDefinition.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      icon: input.icon ?? null,
      owner: input.owner ?? null,
      metadata: jsonValue(input.metadata),
      status: 'DRAFT',
    },
  });

  await recordAudit({
    action: 'service-definition.created',
    resourceType: 'service-definition',
    resourceId: service.id,
    after: service,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return service;
}

export async function getService(serviceId: string) {
  const service = await prisma.serviceDefinition.findFirst({
    where: { id: serviceId, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      templates: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, key: true, name: true, status: true, currentVersion: true, updatedAt: true },
      },
      _count: { select: { tenantAssignments: true } },
    },
  });
  if (!service) throw new NotFoundError('Service definition');

  return { ...service, tenantAssignmentCount: service._count.tenantAssignments };
}

export async function updateService(
  serviceId: string,
  input: UpdateServiceDefinitionInput,
  actor: ActorContext,
): Promise<ServiceDefinition> {
  const existing = await prisma.serviceDefinition.findFirst({ where: { id: serviceId, deletedAt: null } });
  if (!existing) throw new NotFoundError('Service definition');
  await assertCategoryExists(input.categoryId);

  const data: Prisma.ServiceDefinitionUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.owner !== undefined) data.owner = input.owner;
  if (input.metadata !== undefined) data.metadata = jsonValueOrNull(input.metadata);

  const updated = await prisma.serviceDefinition.update({ where: { id: serviceId }, data });

  await recordAudit({
    action: 'service-definition.updated',
    resourceType: 'service-definition',
    resourceId: serviceId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function setServiceStatus(
  serviceId: string,
  status: 'ENABLED' | 'DISABLED',
  actor: ActorContext,
): Promise<ServiceDefinition> {
  const existing = await prisma.serviceDefinition.findFirst({ where: { id: serviceId, deletedAt: null } });
  if (!existing) throw new NotFoundError('Service definition');
  if (existing.status === status) {
    throw new PreconditionFailedError(
      status === 'ENABLED' ? 'This service is already enabled.' : 'This service is already disabled.',
    );
  }

  const updated = await prisma.serviceDefinition.update({ where: { id: serviceId }, data: { status } });

  await recordAudit({
    action: status === 'ENABLED' ? 'service-definition.enabled' : 'service-definition.disabled',
    resourceType: 'service-definition',
    resourceId: serviceId,
    before: { status: existing.status },
    after: { status: updated.status },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listCategories(req: Request) {
  return serviceCategoryCrud.list(req);
}

export async function createCategory(input: CreateServiceCategoryInput, actor: ActorContext): Promise<ServiceCategory> {
  await assertCategoryExists(input.parentId);

  const category = await prisma.serviceCategory.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder,
    },
  });

  await recordAudit({
    action: 'service-category.created',
    resourceType: 'service-category',
    resourceId: category.id,
    after: category,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return category;
}

export async function updateCategory(
  categoryId: string,
  input: UpdateServiceCategoryInput,
  actor: ActorContext,
): Promise<ServiceCategory> {
  const existing = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
  if (!existing) throw new NotFoundError('Service category');

  if (input.parentId !== undefined && input.parentId !== null) {
    await assertCategoryHierarchy(categoryId, input.parentId);
  }

  const data: Prisma.ServiceCategoryUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.parentId !== undefined) data.parentId = input.parentId;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  const updated = await prisma.serviceCategory.update({ where: { id: categoryId }, data });

  await recordAudit({
    action: 'service-category.updated',
    resourceType: 'service-category',
    resourceId: categoryId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function deleteCategory(categoryId: string, actor: ActorContext): Promise<void> {
  const category = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new NotFoundError('Service category');

  const [serviceCount, childCount] = await Promise.all([
    prisma.serviceDefinition.count({ where: { categoryId, deletedAt: null } }),
    prisma.serviceCategory.count({ where: { parentId: categoryId } }),
  ]);
  if (serviceCount > 0) {
    throw new PreconditionFailedError('Move or delete the services in this category before deleting it.');
  }
  if (childCount > 0) {
    throw new PreconditionFailedError('Move or delete the child categories before deleting this category.');
  }

  await prisma.serviceCategory.delete({ where: { id: categoryId } });

  await recordAudit({
    action: 'service-category.deleted',
    resourceType: 'service-category',
    resourceId: categoryId,
    before: category,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
}

export async function listTemplates(req: Request) {
  return serviceTemplateCrud.list(req);
}

export async function createTemplate(input: CreateServiceTemplateInput, actor: ActorContext): Promise<ServiceTemplate> {
  const duplicate = await prisma.serviceTemplate.findUnique({ where: { key: input.key }, select: { id: true } });
  if (duplicate) throw new ConflictError(`A template with the key "${input.key}" already exists.`);
  await assertServiceExists(input.serviceId);
  if (!isNonEmptyObject(input.definition)) {
    throw new ValidationError('Template definition must be a non-empty object.');
  }

  const template = await prisma.serviceTemplate.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      serviceId: input.serviceId ?? null,
      definition: input.definition as unknown as Prisma.InputJsonValue,
      status: 'DRAFT',
      currentVersion: 0,
    },
  });

  await recordAudit({
    action: 'service-template.created',
    resourceType: 'service-template',
    resourceId: template.id,
    after: template,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return template;
}

export async function getTemplate(templateId: string) {
  const template = await prisma.serviceTemplate.findFirst({
    where: { id: templateId, deletedAt: null },
    include: {
      service: { select: { id: true, key: true, name: true } },
      versions: {
        orderBy: { version: 'desc' },
        select: {
          id: true,
          version: true,
          changelog: true,
          publishedAt: true,
          publishedById: true,
          createdAt: true,
        },
      },
    },
  });
  if (!template) throw new NotFoundError('Service template');
  return template;
}

export async function updateTemplate(
  templateId: string,
  input: UpdateServiceTemplateInput,
  actor: ActorContext,
): Promise<ServiceTemplate> {
  const existing = await prisma.serviceTemplate.findFirst({ where: { id: templateId, deletedAt: null } });
  if (!existing) throw new NotFoundError('Service template');
  if (existing.status === 'RETIRED') {
    throw new PreconditionFailedError('Retired templates cannot be updated.');
  }
  await assertServiceExists(input.serviceId);

  const data: Prisma.ServiceTemplateUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.serviceId !== undefined) data.serviceId = input.serviceId;
  if (input.definition !== undefined) {
    if (!isNonEmptyObject(input.definition)) {
      throw new ValidationError('Template definition must be a non-empty object.');
    }
    data.definition = input.definition as unknown as Prisma.InputJsonValue;
  }

  const updated = await prisma.serviceTemplate.update({ where: { id: templateId }, data });

  await recordAudit({
    action: 'service-template.updated',
    resourceType: 'service-template',
    resourceId: templateId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function publishTemplate(templateId: string, actor: ActorContext) {
  const template = await prisma.serviceTemplate.findFirst({ where: { id: templateId, deletedAt: null } });
  if (!template) throw new NotFoundError('Service template');
  if (template.status === 'RETIRED') {
    throw new PreconditionFailedError('Retired templates cannot be published.');
  }
  if (!isNonEmptyObject(template.definition)) {
    throw new PreconditionFailedError('The template definition must be a non-empty object before it can be published.');
  }

  const version = template.currentVersion + 1;
  const publishedAt = new Date();

  const [templateVersion, updated] = await prisma.$transaction([
    prisma.serviceTemplateVersion.create({
      data: {
        templateId,
        version,
        definition: template.definition as unknown as Prisma.InputJsonValue,
        publishedById: actor.actorId ?? null,
        publishedAt,
      },
    }),
    prisma.serviceTemplate.update({
      where: { id: templateId },
      data: { status: 'PUBLISHED', currentVersion: version },
    }),
  ]);

  await recordAudit({
    action: 'service-template.published',
    resourceType: 'service-template',
    resourceId: templateId,
    before: { status: template.status, currentVersion: template.currentVersion },
    after: { status: 'PUBLISHED', currentVersion: version, versionId: templateVersion.id },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({
    eventKey: 'service.published',
    tenantId: null,
    payload: { templateId, key: template.key, version, versionId: templateVersion.id },
  });

  return { ...updated, version: templateVersion };
}

export async function listTemplateVersions(templateId: string, req: Request) {
  const template = await prisma.serviceTemplate.findFirst({
    where: { id: templateId, deletedAt: null },
    select: { id: true },
  });
  if (!template) throw new NotFoundError('Service template');

  const query = parseListQuery(req);
  const where = { templateId };
  const [rows, total] = await Promise.all([
    prisma.serviceTemplateVersion.findMany({
      where,
      orderBy: { version: 'desc' },
      ...paginationArgs(query),
    }),
    prisma.serviceTemplateVersion.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function replaceTenantServices(tenantId: string, serviceIds: string[], actor: ActorContext) {
  const uniqueIds = Array.from(new Set(serviceIds));
  const services = uniqueIds.length
    ? await prisma.serviceDefinition.findMany({
        where: { id: { in: uniqueIds }, deletedAt: null },
        select: { id: true },
      })
    : [];
  const foundIds = new Set(services.map((service) => service.id));
  const missing = uniqueIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new ValidationError(
      'One or more services could not be found.',
      missing.map((id) => ({ field: 'serviceIds', message: `Service "${id}" was not found.` })),
    );
  }

  await prisma.$transaction([
    prisma.tenantServiceAssignment.deleteMany({ where: { tenantId, serviceId: { notIn: uniqueIds } } }),
    ...uniqueIds.map((serviceId) =>
      prisma.tenantServiceAssignment.upsert({
        where: { tenantId_serviceId: { tenantId, serviceId } },
        create: { tenantId, serviceId, isEnabled: true, assignedById: actor.actorId ?? null },
        update: { isEnabled: true },
      }),
    ),
  ]);

  await recordAudit({
    action: 'tenant.services.updated',
    resourceType: 'tenant-service-assignment',
    resourceId: tenantId,
    tenantId,
    metadata: { serviceIds: uniqueIds },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return prisma.tenantServiceAssignment.findMany({
    where: { tenantId },
    include: { service: { select: { id: true, key: true, name: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  });
}
