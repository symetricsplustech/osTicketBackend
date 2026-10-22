import type { Request } from "express";
import {
  Prisma,
  type ClassificationCategory,
  type ItsmModuleConfig,
  type NumberingRule,
  type PriorityDefinition,
  type StatusDefinition,
} from "@prisma/client";
import { prisma } from "../../config/database";
import {
  ConflictError,
  NotFoundError,
  PreconditionFailedError,
} from "../../shared/errors";
import { createCrudService } from "../../shared/crud";
import { parseListQuery } from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import type {
  CreateClassificationCategoryInput,
  CreatePriorityInput,
  CreateStatusInput,
  UpdateClassificationCategoryInput,
  UpdateItsmModuleInput,
  UpdateNumberingRuleInput,
  UpdatePriorityInput,
  UpdateStatusInput,
  UpdateTenantItsmConfigurationInput,
} from "../../validators/saasadmin/itsm-configuration.validators";

export interface ActorContext {
  actorId?: string | null;
  req?: Request;
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function jsonValueOrNull(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

function parseBooleanFilter(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalised = String(value).toLowerCase();
  if (["true", "1", "yes"].includes(normalised)) return true;
  if (["false", "0", "no"].includes(normalised)) return false;
  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const itsmModuleCrud = createCrudService<ItsmModuleConfig>({
  model: prisma.itsmModuleConfig as never,
  resourceType: "itsm-module",
  searchFields: ["moduleKey", "name"],
  allowedSortFields: [
    "moduleKey",
    "name",
    "isEnabled",
    "createdAt",
    "updatedAt",
  ],
  defaultOrderBy: { moduleKey: "asc" },
});

export const priorityCrud = createCrudService<PriorityDefinition>({
  model: prisma.priorityDefinition as never,
  resourceType: "priority",
  searchFields: ["key", "name"],
  allowedSortFields: ["key", "name", "rank", "createdAt", "updatedAt"],
  defaultOrderBy: { rank: "asc" },
});

export const statusCrud = createCrudService<StatusDefinition>({
  model: prisma.statusDefinition as never,
  resourceType: "status",
  searchFields: ["key", "name"],
  filterableFields: ["moduleKey", "category"],
  allowedSortFields: [
    "key",
    "name",
    "moduleKey",
    "category",
    "sortOrder",
    "createdAt",
    "updatedAt",
  ],
  defaultOrderBy: { sortOrder: "asc" },
});

export const classificationCategoryCrud =
  createCrudService<ClassificationCategory>({
    model: prisma.classificationCategory as never,
    resourceType: "classification-category",
    searchFields: ["name"],
    filterableFields: ["moduleKey", "parentId"],
    allowedSortFields: [
      "name",
      "moduleKey",
      "sortOrder",
      "createdAt",
      "updatedAt",
    ],
    defaultOrderBy: { sortOrder: "asc" },
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { children: true } },
    },
  });

export const numberingRuleCrud = createCrudService<NumberingRule>({
  model: prisma.numberingRule as never,
  resourceType: "numbering-rule",
  searchFields: ["moduleKey", "prefix"],
  allowedSortFields: [
    "moduleKey",
    "prefix",
    "nextNumber",
    "createdAt",
    "updatedAt",
  ],
  defaultOrderBy: { moduleKey: "asc" },
});

export async function listItsmModules(req: Request) {
  const query = parseListQuery(req);
  const isEnabled = parseBooleanFilter(query["isEnabled"]);
  return itsmModuleCrud.list(
    req,
    isEnabled === undefined ? undefined : { isEnabled },
  );
}

export async function getItsmModule(moduleKey: string) {
  const module = await prisma.itsmModuleConfig.findUnique({
    where: { moduleKey },
  });
  if (!module) throw new NotFoundError("ITSM module");
  const tenantOverrideCount = await prisma.tenantItsmConfiguration.count({
    where: { moduleKey },
  });
  return { ...module, tenantOverrideCount };
}

export async function updateItsmModule(
  moduleKey: string,
  input: UpdateItsmModuleInput,
  actor: ActorContext,
): Promise<ItsmModuleConfig> {
  const existing = await prisma.itsmModuleConfig.findUnique({
    where: { moduleKey },
  });
  if (!existing) throw new NotFoundError("ITSM module");

  const data: Prisma.ItsmModuleConfigUncheckedUpdateInput = {
    updatedById: actor.actorId ?? null,
  };
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;
  if (input.defaultSettings !== undefined)
    data.defaultSettings = json(input.defaultSettings);

  const updated = await prisma.itsmModuleConfig.update({
    where: { moduleKey },
    data,
  });

  await recordAudit({
    action: "itsm-module.updated",
    resourceType: "itsm-module",
    resourceId: moduleKey,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listPriorities(req: Request) {
  return priorityCrud.list(req);
}

export async function createPriority(
  input: CreatePriorityInput,
  actor: ActorContext,
): Promise<PriorityDefinition> {
  const duplicate = await prisma.priorityDefinition.findUnique({
    where: { key: input.key },
    select: { id: true },
  });
  if (duplicate)
    throw new ConflictError(
      `A priority with the key "${input.key}" already exists.`,
    );

  const priority = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.priorityDefinition.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.priorityDefinition.create({
      data: {
        key: input.key,
        name: input.name,
        rank: input.rank,
        color: input.color ?? null,
        isDefault: input.isDefault,
        settings:
          input.settings === undefined ? undefined : json(input.settings),
      },
    });
  });

  await recordAudit({
    action: "priority.created",
    resourceType: "priority",
    resourceId: priority.id,
    after: priority,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return priority;
}

export async function updatePriority(
  priorityId: string,
  input: UpdatePriorityInput,
  actor: ActorContext,
): Promise<PriorityDefinition> {
  const existing = await prisma.priorityDefinition.findUnique({
    where: { id: priorityId },
  });
  if (!existing) throw new NotFoundError("Priority");

  const data: Prisma.PriorityDefinitionUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.rank !== undefined) data.rank = input.rank;
  if (input.color !== undefined) data.color = input.color;
  if (input.isDefault !== undefined) data.isDefault = input.isDefault;
  if (input.settings !== undefined)
    data.settings = jsonValueOrNull(input.settings);

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.priorityDefinition.updateMany({
        where: { isDefault: true, id: { not: priorityId } },
        data: { isDefault: false },
      });
    }
    return tx.priorityDefinition.update({ where: { id: priorityId }, data });
  });

  await recordAudit({
    action: "priority.updated",
    resourceType: "priority",
    resourceId: priorityId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listStatuses(req: Request) {
  return statusCrud.list(req);
}

export async function createStatus(
  input: CreateStatusInput,
  actor: ActorContext,
): Promise<StatusDefinition> {
  const duplicate = await prisma.statusDefinition.findUnique({
    where: { moduleKey_key: { moduleKey: input.moduleKey, key: input.key } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError(
      `A status with the key "${input.key}" already exists for module "${input.moduleKey}".`,
    );
  }

  const status = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.statusDefinition.updateMany({
        where: { moduleKey: input.moduleKey, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.statusDefinition.create({
      data: {
        key: input.key,
        name: input.name,
        moduleKey: input.moduleKey,
        category: input.category,
        color: input.color ?? null,
        sortOrder: input.sortOrder,
        isDefault: input.isDefault,
      },
    });
  });

  await recordAudit({
    action: "status.created",
    resourceType: "status",
    resourceId: status.id,
    after: status,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return status;
}

export async function updateStatus(
  statusId: string,
  input: UpdateStatusInput,
  actor: ActorContext,
): Promise<StatusDefinition> {
  const existing = await prisma.statusDefinition.findUnique({
    where: { id: statusId },
  });
  if (!existing) throw new NotFoundError("Status");

  const data: Prisma.StatusDefinitionUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.category !== undefined) data.category = input.category;
  if (input.color !== undefined) data.color = input.color;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.isDefault !== undefined) data.isDefault = input.isDefault;

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.statusDefinition.updateMany({
        where: {
          moduleKey: existing.moduleKey,
          isDefault: true,
          id: { not: statusId },
        },
        data: { isDefault: false },
      });
    }
    return tx.statusDefinition.update({ where: { id: statusId }, data });
  });

  await recordAudit({
    action: "status.updated",
    resourceType: "status",
    resourceId: statusId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

async function assertClassificationParent(parentId: string): Promise<void> {
  const parent = await prisma.classificationCategory.findUnique({
    where: { id: parentId },
    select: { id: true },
  });
  if (!parent) throw new NotFoundError("Parent classification category");
}

export async function listClassificationCategories(req: Request) {
  return classificationCategoryCrud.list(req);
}

export async function createClassificationCategory(
  input: CreateClassificationCategoryInput,
  actor: ActorContext,
): Promise<ClassificationCategory> {
  if (input.parentId) {
    await assertClassificationParent(input.parentId);
  }

  const category = await prisma.classificationCategory.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      moduleKey: input.moduleKey,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder,
    },
  });

  await recordAudit({
    action: "classification-category.created",
    resourceType: "classification-category",
    resourceId: category.id,
    after: category,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return category;
}

export async function updateClassificationCategory(
  categoryId: string,
  input: UpdateClassificationCategoryInput,
  actor: ActorContext,
): Promise<ClassificationCategory> {
  const existing = await prisma.classificationCategory.findUnique({
    where: { id: categoryId },
  });
  if (!existing) throw new NotFoundError("Classification category");

  if (input.parentId !== undefined && input.parentId !== null) {
    if (input.parentId === categoryId) {
      throw new PreconditionFailedError("A category cannot be its own parent.");
    }
    await assertClassificationParent(input.parentId);
  }

  const data: Prisma.ClassificationCategoryUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.parentId !== undefined) data.parentId = input.parentId;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const updated = await prisma.classificationCategory.update({
    where: { id: categoryId },
    data,
  });

  await recordAudit({
    action: "classification-category.updated",
    resourceType: "classification-category",
    resourceId: categoryId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listNumberingRules(req: Request) {
  return numberingRuleCrud.list(req);
}

export async function updateNumberingRule(
  ruleId: string,
  input: UpdateNumberingRuleInput,
  actor: ActorContext,
): Promise<NumberingRule> {
  const existing = await prisma.numberingRule.findUnique({
    where: { id: ruleId },
  });
  if (!existing) throw new NotFoundError("Numbering rule");

  const data: Prisma.NumberingRuleUncheckedUpdateInput = {
    updatedById: actor.actorId ?? null,
  };
  if (input.prefix !== undefined) data.prefix = input.prefix;
  if (input.suffix !== undefined) data.suffix = input.suffix;
  if (input.padding !== undefined) data.padding = input.padding;
  if (input.nextNumber !== undefined) data.nextNumber = input.nextNumber;
  if (input.resetPolicy !== undefined) data.resetPolicy = input.resetPolicy;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const updated = await prisma.numberingRule.update({
    where: { id: ruleId },
    data,
  });

  await recordAudit({
    action: "numbering-rule.updated",
    resourceType: "numbering-rule",
    resourceId: ruleId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function getTenantItsmConfiguration(tenantId: string) {
  const [modules, overrides] = await Promise.all([
    prisma.itsmModuleConfig.findMany({ orderBy: { moduleKey: "asc" } }),
    prisma.tenantItsmConfiguration.findMany({ where: { tenantId } }),
  ]);

  const overrideByModule = new Map(
    overrides.map((row) => [row.moduleKey, row]),
  );

  return {
    tenantId,
    modules: modules.map((module) => {
      const override = overrideByModule.get(module.moduleKey);
      const globalSettings = isPlainObject(module.defaultSettings)
        ? module.defaultSettings
        : {};
      const moduleOverrides =
        override && isPlainObject(override.overrides) ? override.overrides : {};

      return {
        moduleKey: module.moduleKey,
        name: module.name,
        isEnabled: module.isEnabled,
        global: globalSettings,
        overrides: moduleOverrides,
        effective: { ...globalSettings, ...moduleOverrides },
        updatedAt: override?.updatedAt ?? null,
      };
    }),
  };
}

export async function updateTenantItsmConfiguration(
  tenantId: string,
  input: UpdateTenantItsmConfigurationInput,
  actor: ActorContext,
) {
  const module = await prisma.itsmModuleConfig.findUnique({
    where: { moduleKey: input.moduleKey },
  });
  if (!module) throw new NotFoundError("ITSM module");

  const record = await prisma.tenantItsmConfiguration.upsert({
    where: { tenantId_moduleKey: { tenantId, moduleKey: input.moduleKey } },
    create: {
      tenantId,
      moduleKey: input.moduleKey,
      overrides: json(input.overrides),
      updatedById: actor.actorId ?? null,
    },
    update: {
      overrides: json(input.overrides),
      updatedById: actor.actorId ?? null,
    },
  });

  await recordAudit({
    action: "tenant.itsm-configuration.updated",
    resourceType: "tenant-itsm-configuration",
    resourceId: record.id,
    tenantId,
    metadata: { moduleKey: input.moduleKey, overrides: input.overrides },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  const globalSettings = isPlainObject(module.defaultSettings)
    ? module.defaultSettings
    : {};
  return { ...record, effective: { ...globalSettings, ...input.overrides } };
}
