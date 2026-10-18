import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, PreconditionFailedError, ConflictError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { createItsmCrudService, assertUnique } from './crud';
import { generateTicketNumber } from './shared';
import type { TenantActorContext } from '../tenantadmin/roles.service';

// --- Categories -----------------------------------------------------------
export const knowledgeCategoryService = createItsmCrudService({
  resourceType: 'knowledge_category',
  label: 'Knowledge category',
  model: prisma.knowledgeArticleCategory,
  searchFields: ['name', 'description'],
  allowedSortFields: ['name', 'sortOrder', 'status', 'createdAt', 'updatedAt'],
  include: { _count: { select: { articles: true, children: true } } },
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === 'string' && input.name) {
      await assertUnique(prisma.knowledgeArticleCategory, tenantId, 'name', input.name, 'knowledge category', existing?.id);
    }
  },
  beforeDelete: async (tenantId, record) => {
    const articles = await prisma.knowledgeArticle.count({ where: { categoryId: record.id, tenantId, deletedAt: null } });
    if (articles > 0) throw new PreconditionFailedError('Reassign knowledge articles before deleting this category.');
    const children = await prisma.knowledgeArticleCategory.count({
      where: { parentId: record.id, tenantId, deletedAt: null },
    });
    if (children > 0) throw new PreconditionFailedError('Reassign sub-categories before deleting this category.');
  },
});

// --- Articles -------------------------------------------------------------
const base = createItsmCrudService({
  resourceType: 'knowledge_article',
  label: 'Knowledge article',
  model: prisma.knowledgeArticle,
  searchFields: ['title', 'summary', 'body', 'number'],
  allowedSortFields: ['title', 'status', 'visibility', 'viewCount', 'publishedAt', 'createdAt', 'updatedAt'],
  filterFields: ['categoryId', 'visibility', 'authorId'],
  include: { category: { select: { id: true, name: true } } },
  mapInput: async (input, { tenantId, existing }) => {
    if (existing) return input;
    const count = await prisma.knowledgeArticle.count({ where: { tenantId } });
    const number = await generateTicketNumber(
      'knowledge',
      'KB',
      async (candidate) =>
        Boolean(await prisma.knowledgeArticle.findFirst({ where: { tenantId, number: candidate }, select: { id: true } })),
      count + 1,
    );
    return { ...input, number };
  },
});

export const knowledgeArticleService = {
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
    if (status === 'PUBLISHED') {
      patch.publishedAt = new Date();
      patch.reviewedAt = new Date();
      patch.reviewerId = actor.actorId ?? null;
    }
    if (status === 'ARCHIVED') patch.archivedAt = new Date();
    return base.transition(tenantId, id, actor, action, status, patch);
  },

  async listComments(tenantId: string, articleId: string, req: Request) {
    const article = await prisma.knowledgeArticle.findFirst({
      where: { id: articleId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!article) throw new NotFoundError('Knowledge article');
    const query = parseListQuery(req, { maxLimit: 100 });
    const where = { articleId, tenantId };
    const [rows, total] = await Promise.all([
      prisma.knowledgeArticleComment.findMany({ where, orderBy: { createdAt: 'asc' }, ...paginationArgs(query) }),
      prisma.knowledgeArticleComment.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async addComment(
    tenantId: string,
    articleId: string,
    input: { body: string; isInternal?: boolean },
    actor: TenantActorContext,
  ) {
    const article = await prisma.knowledgeArticle.findFirst({
      where: { id: articleId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!article) throw new NotFoundError('Knowledge article');
    const comment = await prisma.knowledgeArticleComment.create({
      data: { tenantId, articleId, body: input.body, isInternal: input.isInternal ?? false, authorId: actor.actorId ?? null },
    });
    await recordAudit({
      action: 'knowledge_article.comment.added',
      resourceType: 'knowledge_article',
      resourceId: articleId,
      tenantId,
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return comment;
  },
};

export const DEFAULT_KNOWLEDGE_SETTINGS: Record<string, unknown> = {
  defaultVisibility: 'INTERNAL',
  requireReviewBeforePublish: true,
  allowInternalComments: true,
  enableFeedback: true,
  enableVersioning: true,
  reviewIntervalDays: 180,
};

export const knowledgeSettingsService = {
  async get(tenantId: string) {
    const row = await prisma.knowledgeTenantSetting.findUnique({ where: { tenantId } });
    const settings = row?.settings;
    return {
      settings:
        settings && typeof settings === 'object' && !Array.isArray(settings)
          ? { ...DEFAULT_KNOWLEDGE_SETTINGS, ...(settings as Record<string, unknown>) }
          : { ...DEFAULT_KNOWLEDGE_SETTINGS },
      updatedAt: row?.updatedAt ?? null,
    };
  },

  async update(tenantId: string, input: Record<string, unknown>, actor: TenantActorContext) {
    const before = await knowledgeSettingsService.get(tenantId);
    const merged = { ...before.settings, ...input };
    const row = await prisma.knowledgeTenantSetting.upsert({
      where: { tenantId },
      create: { tenantId, settings: merged as Prisma.InputJsonValue, updatedById: actor.actorId ?? null },
      update: { settings: merged as Prisma.InputJsonValue, updatedById: actor.actorId ?? null },
    });
    await recordAudit({
      action: 'knowledge.settings.updated',
      resourceType: 'knowledge_settings',
      resourceId: row.id,
      tenantId,
      before: before.settings,
      after: merged,
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return { settings: merged, updatedAt: row.updatedAt };
  },
};

export async function assertKnowledgeCategory(tenantId: string, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const category = await prisma.knowledgeArticleCategory.findFirst({
    where: { id: categoryId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!category) throw new ConflictError('The selected knowledge category could not be found.');
}

export type KnowledgeArticleWhere = Prisma.KnowledgeArticleWhereInput;
