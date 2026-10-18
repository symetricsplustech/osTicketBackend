import type { Request } from 'express';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { createItsmCrudService } from './crud';
import type { TenantActorContext } from '../tenantadmin/roles.service';

const reviewBase = createItsmCrudService({
  resourceType: 'access_review',
  label: 'Access review',
  model: prisma.tenantAccessReview,
  searchFields: ['name', 'description', 'scope'],
  allowedSortFields: ['name', 'status', 'dueAt', 'createdAt', 'updatedAt'],
  filterFields: ['status', 'scope'],
});

export const accessReviewService = {
  ...reviewBase,
  async start(tenantId: string, id: string, actor: TenantActorContext) {
    return reviewBase.transition(tenantId, id, actor, 'started', 'ACTIVE', { startedAt: new Date() });
  },
  async complete(tenantId: string, id: string, actor: TenantActorContext) {
    return reviewBase.transition(tenantId, id, actor, 'completed', 'COMPLETED', { completedAt: new Date() });
  },
  async cancel(tenantId: string, id: string, actor: TenantActorContext) {
    return reviewBase.transition(tenantId, id, actor, 'cancelled', 'CANCELLED', {});
  },

  async listItems(tenantId: string, reviewId: string, req: Request) {
    await this.assertReview(tenantId, reviewId);
    const query = parseListQuery(req, { maxLimit: 200 });
    const where = { tenantId, reviewId };
    const [rows, total] = await Promise.all([
      prisma.tenantAccessReviewItem.findMany({ where, orderBy: { createdAt: 'asc' }, ...paginationArgs(query) }),
      prisma.tenantAccessReviewItem.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async addItem(tenantId: string, reviewId: string, input: { subjectType: string; subjectId: string }, actor: TenantActorContext) {
    await this.assertReview(tenantId, reviewId);
    const dup = await prisma.tenantAccessReviewItem.findFirst({ where: { reviewId, subjectType: input.subjectType, subjectId: input.subjectId }, select: { id: true } });
    if (dup) throw new ConflictError('This subject is already part of the review.');
    const item = await prisma.tenantAccessReviewItem.create({ data: { tenantId, reviewId, subjectType: input.subjectType, subjectId: input.subjectId } });
    await recordAudit({
      action: 'access_review.item.created',
      resourceType: 'access_review',
      resourceId: reviewId,
      tenantId,
      after: item,
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return item;
  },

  async decideItem(tenantId: string, reviewId: string, itemId: string, decision: string, notes: string | undefined, actor: TenantActorContext) {
    await this.assertReview(tenantId, reviewId);
    const item = await prisma.tenantAccessReviewItem.findFirst({ where: { id: itemId, tenantId, reviewId } });
    if (!item) throw new NotFoundError('Access review item');
    const updated = await prisma.tenantAccessReviewItem.update({
      where: { id: itemId },
      data: { decision, notes: notes ?? null, decidedById: actor.actorId ?? null, decidedAt: new Date() },
    });
    await recordAudit({
      action: 'access_review.item.decided',
      resourceType: 'access_review',
      resourceId: reviewId,
      tenantId,
      before: { decision: item.decision },
      after: { decision: updated.decision },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return updated;
  },

  async removeItem(tenantId: string, reviewId: string, itemId: string, actor: TenantActorContext) {
    await this.assertReview(tenantId, reviewId);
    const item = await prisma.tenantAccessReviewItem.findFirst({ where: { id: itemId, tenantId, reviewId } });
    if (!item) throw new NotFoundError('Access review item');
    await prisma.tenantAccessReviewItem.delete({ where: { id: itemId } });
    await recordAudit({
      action: 'access_review.item.deleted',
      resourceType: 'access_review',
      resourceId: reviewId,
      tenantId,
      before: item,
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
  },

  async assertReview(tenantId: string, reviewId: string) {
    const review = await prisma.tenantAccessReview.findFirst({ where: { id: reviewId, tenantId, deletedAt: null }, select: { id: true } });
    if (!review) throw new NotFoundError('Access review');
  },
};
