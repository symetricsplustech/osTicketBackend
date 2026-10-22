import type { Request } from "express";
import {
  Prisma,
  type KnowledgeCategory,
  type KnowledgePolicy,
  type KnowledgeReviewRule,
  type KnowledgeTemplate,
} from "@prisma/client";
import { prisma } from "../../config/database";
import {
  ConflictError,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from "../../shared/errors";
import { createCrudService } from "../../shared/crud";
import { parseListQuery } from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import type {
  CreateKnowledgeCategoryInput,
  CreateKnowledgePolicyInput,
  CreateKnowledgeReviewRuleInput,
  CreateKnowledgeTemplateInput,
  UpdateKnowledgeCategoryInput,
  UpdateKnowledgePolicyInput,
  UpdateKnowledgeReviewRuleInput,
  UpdateKnowledgeTemplateInput,
} from "../../validators/saasadmin/knowledge-management.validators";

export interface ActorContext {
  actorId?: string | null;
  req?: Request;
}

const DEFAULT_TENANT_KNOWLEDGE_SETTINGS = {
  reviewsEnabled: true,
  tenantAuthoringEnabled: true,
};

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

export const knowledgePolicyCrud = createCrudService<KnowledgePolicy>({
  model: prisma.knowledgePolicy as never,
  resourceType: "knowledge-policy",
  searchFields: ["name"],
  allowedSortFields: ["name", "isEnabled", "createdAt", "updatedAt"],
  defaultOrderBy: { createdAt: "desc" },
});

export const knowledgeCategoryCrud = createCrudService<KnowledgeCategory>({
  model: prisma.knowledgeCategory as never,
  resourceType: "knowledge-category",
  searchFields: ["name"],
  filterableFields: ["parentId"],
  allowedSortFields: ["name", "sortOrder", "createdAt", "updatedAt"],
  defaultOrderBy: { sortOrder: "asc" },
  include: {
    parent: { select: { id: true, name: true } },
    children: {
      select: { id: true, name: true, sortOrder: true, isActive: true },
      orderBy: { sortOrder: "asc" },
    },
    _count: { select: { children: true, templates: true } },
  },
});

export const knowledgeTemplateCrud = createCrudService<KnowledgeTemplate>({
  model: prisma.knowledgeTemplate as never,
  resourceType: "knowledge-template",
  searchFields: ["key", "name"],
  filterableFields: ["status", "categoryId"],
  allowedSortFields: ["key", "name", "status", "createdAt", "updatedAt"],
  defaultOrderBy: { createdAt: "desc" },
  include: {
    category: { select: { id: true, name: true } },
  },
});

export const knowledgeReviewRuleCrud = createCrudService<KnowledgeReviewRule>({
  model: prisma.knowledgeReviewRule as never,
  resourceType: "knowledge-review-rule",
  searchFields: ["name"],
  filterableFields: ["categoryId", "action"],
  allowedSortFields: [
    "name",
    "intervalDays",
    "action",
    "createdAt",
    "updatedAt",
  ],
  defaultOrderBy: { createdAt: "desc" },
  include: {
    category: { select: { id: true, name: true } },
  },
});

export async function listPolicies(req: Request) {
  const query = parseListQuery(req);
  const isEnabled = parseBooleanFilter(query["isEnabled"]);
  return knowledgePolicyCrud.list(
    req,
    isEnabled === undefined ? undefined : { isEnabled },
  );
}

export async function createPolicy(
  input: CreateKnowledgePolicyInput,
  actor: ActorContext,
): Promise<KnowledgePolicy> {
  const policy = await prisma.knowledgePolicy.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      settings: json(input.settings),
      isEnabled: input.isEnabled,
    },
  });

  await recordAudit({
    action: "knowledge-policy.created",
    resourceType: "knowledge-policy",
    resourceId: policy.id,
    after: policy,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return policy;
}

export async function updatePolicy(
  policyId: string,
  input: UpdateKnowledgePolicyInput,
  actor: ActorContext,
): Promise<KnowledgePolicy> {
  const existing = await prisma.knowledgePolicy.findUnique({
    where: { id: policyId },
  });
  if (!existing) throw new NotFoundError("Knowledge policy");

  const data: Prisma.KnowledgePolicyUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.settings !== undefined) data.settings = json(input.settings);
  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;

  const updated = await prisma.knowledgePolicy.update({
    where: { id: policyId },
    data,
  });

  await recordAudit({
    action: "knowledge-policy.updated",
    resourceType: "knowledge-policy",
    resourceId: policyId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

async function assertKnowledgeCategoryExists(
  categoryId: string | null | undefined,
): Promise<void> {
  if (categoryId === undefined || categoryId === null) return;
  const category = await prisma.knowledgeCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) throw new NotFoundError("Knowledge category");
}

export async function listCategories(req: Request) {
  return knowledgeCategoryCrud.list(req);
}

export async function createCategory(
  input: CreateKnowledgeCategoryInput,
  actor: ActorContext,
): Promise<KnowledgeCategory> {
  await assertKnowledgeCategoryExists(input.parentId);

  const category = await prisma.knowledgeCategory.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder,
    },
  });

  await recordAudit({
    action: "knowledge-category.created",
    resourceType: "knowledge-category",
    resourceId: category.id,
    after: category,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return category;
}

export async function updateCategory(
  categoryId: string,
  input: UpdateKnowledgeCategoryInput,
  actor: ActorContext,
): Promise<KnowledgeCategory> {
  const existing = await prisma.knowledgeCategory.findUnique({
    where: { id: categoryId },
  });
  if (!existing) throw new NotFoundError("Knowledge category");

  if (input.parentId !== undefined && input.parentId !== null) {
    if (input.parentId === categoryId) {
      throw new PreconditionFailedError("A category cannot be its own parent.");
    }
    await assertKnowledgeCategoryExists(input.parentId);
  }

  const data: Prisma.KnowledgeCategoryUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.parentId !== undefined) data.parentId = input.parentId;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const updated = await prisma.knowledgeCategory.update({
    where: { id: categoryId },
    data,
  });

  await recordAudit({
    action: "knowledge-category.updated",
    resourceType: "knowledge-category",
    resourceId: categoryId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listTemplates(req: Request) {
  return knowledgeTemplateCrud.list(req);
}

export async function createTemplate(
  input: CreateKnowledgeTemplateInput,
  actor: ActorContext,
): Promise<KnowledgeTemplate> {
  const duplicate = await prisma.knowledgeTemplate.findUnique({
    where: { key: input.key },
    select: { id: true },
  });
  if (duplicate)
    throw new ConflictError(
      `A knowledge template with the key "${input.key}" already exists.`,
    );
  if (input.body.trim().length === 0) {
    throw new ValidationError("Template body must not be empty.");
  }
  await assertKnowledgeCategoryExists(input.categoryId);

  const template = await prisma.knowledgeTemplate.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      body: input.body,
      fields: input.fields === undefined ? undefined : json(input.fields),
      status: input.status,
    },
  });

  await recordAudit({
    action: "knowledge-template.created",
    resourceType: "knowledge-template",
    resourceId: template.id,
    after: template,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return template;
}

export async function updateTemplate(
  templateId: string,
  input: UpdateKnowledgeTemplateInput,
  actor: ActorContext,
): Promise<KnowledgeTemplate> {
  const existing = await prisma.knowledgeTemplate.findUnique({
    where: { id: templateId },
  });
  if (!existing) throw new NotFoundError("Knowledge template");
  if (input.body !== undefined && input.body.trim().length === 0) {
    throw new ValidationError("Template body must not be empty.");
  }
  await assertKnowledgeCategoryExists(input.categoryId);

  const data: Prisma.KnowledgeTemplateUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.body !== undefined) data.body = input.body;
  if (input.fields !== undefined) data.fields = jsonValueOrNull(input.fields);
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.status !== undefined) data.status = input.status;

  const updated = await prisma.knowledgeTemplate.update({
    where: { id: templateId },
    data,
  });

  await recordAudit({
    action: "knowledge-template.updated",
    resourceType: "knowledge-template",
    resourceId: templateId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listReviewRules(req: Request) {
  const query = parseListQuery(req);
  const isEnabled = parseBooleanFilter(query["isEnabled"]);
  return knowledgeReviewRuleCrud.list(
    req,
    isEnabled === undefined ? undefined : { isEnabled },
  );
}

export async function createReviewRule(
  input: CreateKnowledgeReviewRuleInput,
  actor: ActorContext,
): Promise<KnowledgeReviewRule> {
  await assertKnowledgeCategoryExists(input.categoryId);
  if (input.notifyBeforeDays >= input.intervalDays) {
    throw new ValidationError(
      "Notify-before days must be smaller than the review interval.",
      [
        {
          field: "notifyBeforeDays",
          message:
            "Notify-before days must be smaller than the review interval.",
        },
      ],
    );
  }

  const rule = await prisma.knowledgeReviewRule.create({
    data: {
      name: input.name,
      categoryId: input.categoryId ?? null,
      intervalDays: input.intervalDays,
      notifyBeforeDays: input.notifyBeforeDays,
      action: input.action,
      isEnabled: input.isEnabled,
    },
  });

  await recordAudit({
    action: "knowledge-review-rule.created",
    resourceType: "knowledge-review-rule",
    resourceId: rule.id,
    after: rule,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return rule;
}

export async function updateReviewRule(
  ruleId: string,
  input: UpdateKnowledgeReviewRuleInput,
  actor: ActorContext,
): Promise<KnowledgeReviewRule> {
  const existing = await prisma.knowledgeReviewRule.findUnique({
    where: { id: ruleId },
  });
  if (!existing) throw new NotFoundError("Knowledge review rule");
  await assertKnowledgeCategoryExists(input.categoryId);

  const intervalDays = input.intervalDays ?? existing.intervalDays;
  const notifyBeforeDays = input.notifyBeforeDays ?? existing.notifyBeforeDays;
  if (notifyBeforeDays >= intervalDays) {
    throw new ValidationError(
      "Notify-before days must be smaller than the review interval.",
      [
        {
          field: "notifyBeforeDays",
          message:
            "Notify-before days must be smaller than the review interval.",
        },
      ],
    );
  }

  const data: Prisma.KnowledgeReviewRuleUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.intervalDays !== undefined) data.intervalDays = input.intervalDays;
  if (input.notifyBeforeDays !== undefined)
    data.notifyBeforeDays = input.notifyBeforeDays;
  if (input.action !== undefined) data.action = input.action;
  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;

  const updated = await prisma.knowledgeReviewRule.update({
    where: { id: ruleId },
    data,
  });

  await recordAudit({
    action: "knowledge-review-rule.updated",
    resourceType: "knowledge-review-rule",
    resourceId: ruleId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function getTenantSettings(tenantId: string) {
  const record = await prisma.knowledgeTenantSetting.findUnique({
    where: { tenantId },
  });
  return {
    tenantId,
    settings: record?.settings ?? DEFAULT_TENANT_KNOWLEDGE_SETTINGS,
    isDefault: !record,
    updatedAt: record?.updatedAt ?? null,
  };
}

export async function updateTenantSettings(
  tenantId: string,
  settings: Record<string, unknown>,
  actor: ActorContext,
) {
  const record = await prisma.knowledgeTenantSetting.upsert({
    where: { tenantId },
    create: {
      tenantId,
      settings: json(settings),
      updatedById: actor.actorId ?? null,
    },
    update: { settings: json(settings), updatedById: actor.actorId ?? null },
  });

  await recordAudit({
    action: "tenant.knowledge-settings.updated",
    resourceType: "knowledge-tenant-setting",
    resourceId: record.id,
    tenantId,
    metadata: { settings },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return record;
}
