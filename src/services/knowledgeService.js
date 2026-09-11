/**
 * Knowledge Management service — business logic for KB, articles, versions,
 * feedback, ratings, comments, criteria, approvals.
 */
const mongoose = require('mongoose');
const { emitEvent } = require('../realtime/socketManager');
const auditEventService = require('./auditEventService');
const numberingService = require('./numbering.service');
const { assertTransition } = require('./stateMachine.service');

const requireTenant = (ctx) => {
  if (!ctx.tenantId) throw Object.assign(new Error('Tenant context required'), { statusCode: 400 });
  return ctx.tenantId;
};

const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));

const Faq = mongoose.model('Faq');
const FaqCategory = mongoose.model('FaqCategory');
const KnowledgeBase = mongoose.model('KnowledgeBase');
const KnowledgeVersion = mongoose.model('KnowledgeVersion');
const KnowledgeFeedback = mongoose.model('KnowledgeFeedback');
const KnowledgeRating = mongoose.model('KnowledgeRating');
const KnowledgeComment = mongoose.model('KnowledgeComment');
const KnowledgeReaderCriteria = mongoose.model('KnowledgeReaderCriteria');
const KnowledgeContributorCriteria = mongoose.model('KnowledgeContributorCriteria');
const KnowledgeApproval = mongoose.model('KnowledgeApproval');

// ─── Knowledge Base CRUD ────────────────────────────────────────────────

exports.listKnowledgeBases = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['isActive', 'visibility']) };
  return KnowledgeBase.find(filter).sort({ sortOrder: 1, name: 1 });
};

exports.getKnowledgeBase = async (ctx, kbId) => {
  const tenantId = requireTenant(ctx);
  const kb = await KnowledgeBase.findOne({ _id: kbId, tenantId, isDeleted: false });
  if (!kb) throw Object.assign(new Error('Knowledge base not found'), { statusCode: 404 });
  return kb;
};

exports.createKnowledgeBase = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'KB');
  const kb = await KnowledgeBase.create({ ...data, tenantId, number, createdBy: actor.userId });
  await auditEventService.log({ tenantId, actorId: actor.userId, action: 'knowledgeBase.create', entityType: 'KnowledgeBase', entityId: kb._id });
  return kb;
};

exports.updateKnowledgeBase = async (ctx, kbId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const kb = await KnowledgeBase.findOne({ _id: kbId, tenantId, isDeleted: false });
  if (!kb) throw Object.assign(new Error('Knowledge base not found'), { statusCode: 404 });
  const allowed = ['name', 'title', 'description', 'icon', 'color', 'visibility', 'isActive', 'sortOrder', 'owner', 'managerGroup', 'allowComments', 'allowRatings', 'requireApproval', 'autoExpireDays', 'reviewCycleDays', 'meta'];
  Object.assign(kb, pick(data, allowed));
  await kb.save();
  return kb;
};

exports.deleteKnowledgeBase = async (ctx, kbId, actor) => {
  const tenantId = requireTenant(ctx);
  const kb = await KnowledgeBase.findOne({ _id: kbId, tenantId, isDeleted: false });
  if (!kb) throw Object.assign(new Error('Knowledge base not found'), { statusCode: 404 });
  kb.isDeleted = true;
  kb.deletedAt = new Date();
  kb.deletedBy = actor.userId;
  await kb.save();
  return { success: true };
};

// ─── Category CRUD ──────────────────────────────────────────────────────

exports.listCategories = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { company: tenantId, ...pick(query, ['isPublic']) };
  return FaqCategory.find(filter).sort({ sortOrder: 1, name: 1 });
};

exports.getCategory = async (ctx, categoryId) => {
  const tenantId = requireTenant(ctx);
  const cat = await FaqCategory.findOne({ _id: categoryId, company: tenantId });
  if (!cat) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  return cat;
};

exports.createCategory = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const cat = await FaqCategory.create({ ...data, company: tenantId, createdBy: actor.userId });
  return cat;
};

exports.updateCategory = async (ctx, categoryId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const cat = await FaqCategory.findOne({ _id: categoryId, company: tenantId });
  if (!cat) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  const allowed = ['name', 'description', 'isPublic', 'sortOrder'];
  Object.assign(cat, pick(data, allowed));
  await cat.save();
  return cat;
};

exports.deleteCategory = async (ctx, categoryId, actor) => {
  const tenantId = requireTenant(ctx);
  const cat = await FaqCategory.findOne({ _id: categoryId, company: tenantId });
  if (!cat) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  await FaqCategory.deleteOne({ _id: categoryId });
  return { success: true };
};

// ─── Article CRUD ───────────────────────────────────────────────────────

exports.listArticles = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { company: tenantId, ...pick(query, ['lifecycle', 'category', 'knowledgeBaseId', 'visibility', 'internalOnly', 'isPublished']) };
  if (query.search) filter.$or = [
    { question: { $regex: query.search, $options: 'i' } },
    { answer: { $regex: query.search, $options: 'i' } },
    { keywords: { $in: [new RegExp(query.search, 'i')] } },
  ];
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 25));
  const [items, total] = await Promise.all([
    Faq.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('category', 'name').populate('knowledgeBaseId', 'name'),
    Faq.countDocuments(filter),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
};

exports.getArticle = async (ctx, articleId) => {
  const tenantId = requireTenant(ctx);
  const article = await Faq.findOne({ _id: articleId, company: tenantId })
    .populate('category', 'name').populate('knowledgeBaseId', 'name')
    .populate('relatedArticles', 'question lifecycle')
    .populate('primaryKnownError', 'number title');
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  return article;
};

exports.createArticle = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'KBART');
  const article = await Faq.create({
    ...data, company: tenantId, number,
    lifecycle: 'draft', isPublished: false,
    createdBy: actor.userId, version: 1, maxVersion: 1,
  });
  // Create initial version
  await KnowledgeVersion.create({
    tenantId, articleId: article._id, version: 1,
    question: article.question, answer: article.answer,
    keywords: article.keywords, category: article.category,
    visibility: article.visibility, lifecycle: article.lifecycle,
    changeSummary: 'Initial creation', changeType: 'create',
    createdBy: actor.userId,
  });
  await auditEventService.log({ tenantId, actorId: actor.userId, action: 'article.create', entityType: 'Faq', entityId: article._id });
  return article;
};

exports.updateArticle = async (ctx, articleId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const article = await Faq.findOne({ _id: articleId, company: tenantId });
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  const allowed = ['question', 'answer', 'shortSummary', 'keywords', 'category', 'knowledgeBaseId', 'visibility', 'internalOnly', 'visibleDepartments', 'visibleTeams', 'relatedProducts', 'relatedArticles', 'expiresAt', 'meta'];
  const before = { question: article.question, answer: article.answer };
  Object.assign(article, pick(data, allowed));
  // Version bump
  article.version = article.version + 1;
  article.maxVersion = article.version;
  article.lastVersionedBy = actor.userId;
  article.lastVersionedAt = new Date();
  article.analytics = article.analytics || {};
  article.analytics.lastEditedAt = new Date();
  article.analytics.lastEditedBy = actor.userId;
  await article.save();
  // Create version snapshot
  await KnowledgeVersion.create({
    tenantId, articleId: article._id, version: article.version,
    question: article.question, answer: article.answer,
    keywords: article.keywords, category: article.category,
    visibility: article.visibility, lifecycle: article.lifecycle,
    changeSummary: data.changeSummary || 'Updated', changeType: 'edit',
    createdBy: actor.userId,
  });
  await auditEventService.log({ tenantId, actorId: actor.userId, action: 'article.update', entityType: 'Faq', entityId: articleId, before, after: { question: article.question, answer: article.answer } });
  return article;
};

exports.deleteArticle = async (ctx, articleId, actor) => {
  const tenantId = requireTenant(ctx);
  const article = await Faq.findOne({ _id: articleId, company: tenantId });
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  await Faq.deleteOne({ _id: articleId });
  await auditEventService.log({ tenantId, actorId: actor.userId, action: 'article.delete', entityType: 'Faq', entityId: articleId });
  return { success: true };
};

// ─── Article Lifecycle Transitions ──────────────────────────────────────

exports.transitionArticle = async (ctx, articleId, toLifecycle, data, actor) => {
  const tenantId = requireTenant(ctx);
  const article = await Faq.findOne({ _id: articleId, company: tenantId });
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  assertTransition('faq', article.lifecycle, toLifecycle);
  const before = { lifecycle: article.lifecycle, isPublished: article.isPublished };
  article.lifecycle = toLifecycle;
  if (toLifecycle === 'review') {
    article.reviewedBy = null;
    article.reviewedAt = null;
  } else if (toLifecycle === 'approved') {
    article.reviewedBy = actor.userId;
    article.reviewedAt = new Date();
  } else if (toLifecycle === 'published') {
    article.isPublished = true;
    article.publishedAt = new Date();
  } else if (toLifecycle === 'expired') {
    article.isPublished = false;
    article.expiresAt = new Date();
  } else if (toLifecycle === 'archived') {
    article.isPublished = false;
  }
  await article.save();
  // Create version entry for lifecycle change
  await KnowledgeVersion.create({
    tenantId, articleId: article._id, version: article.version,
    question: article.question, answer: article.answer,
    keywords: article.keywords, category: article.category,
    visibility: article.visibility, lifecycle: toLifecycle,
    changeSummary: data?.reason || `Transitioned to ${toLifecycle}`, changeType: toLifecycle === 'published' ? 'publish' : toLifecycle === 'archived' ? 'retire' : 'edit',
    createdBy: actor.userId,
  });
  await auditEventService.log({ tenantId, actorId: actor.userId, action: `article.${toLifecycle}`, entityType: 'Faq', entityId: articleId, before, after: { lifecycle: article.lifecycle } });
  emitEvent(tenantId, 'article:updated', { articleId: article._id, lifecycle: article.lifecycle });
  return article;
};

// ─── Version Management ─────────────────────────────────────────────────

exports.listVersions = async (ctx, articleId) => {
  const tenantId = requireTenant(ctx);
  return KnowledgeVersion.find({ tenantId, articleId }).sort({ version: -1 });
};

exports.getVersion = async (ctx, versionId) => {
  const tenantId = requireTenant(ctx);
  const version = await KnowledgeVersion.findOne({ _id: versionId, tenantId });
  if (!version) throw Object.assign(new Error('Version not found'), { statusCode: 404 });
  return version;
};

exports.restoreVersion = async (ctx, articleId, versionId, actor) => {
  const tenantId = requireTenant(ctx);
  const version = await KnowledgeVersion.findOne({ _id: versionId, tenantId, articleId });
  if (!version) throw Object.assign(new Error('Version not found'), { statusCode: 404 });
  const article = await Faq.findOne({ _id: articleId, company: tenantId });
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  article.question = version.question;
  article.answer = version.answer;
  article.keywords = version.keywords;
  article.category = version.category;
  article.visibility = version.visibility;
  article.lifecycle = version.lifecycle;
  article.version = article.version + 1;
  article.maxVersion = article.version;
  article.lastVersionedBy = actor.userId;
  article.lastVersionedAt = new Date();
  await article.save();
  await KnowledgeVersion.create({
    tenantId, articleId: article._id, version: article.version,
    question: article.question, answer: article.answer,
    keywords: article.keywords, category: article.category,
    visibility: article.visibility, lifecycle: article.lifecycle,
    changeSummary: `Restored from version ${version.version}`, changeType: 'restore',
    createdBy: actor.userId,
  });
  return article;
};

// ─── Feedback ───────────────────────────────────────────────────────────

exports.listFeedback = async (ctx, articleId, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, articleId, isDeleted: false, ...pick(query, ['type', 'status']) };
  return KnowledgeFeedback.find(filter).sort({ createdAt: -1 }).populate('userId', 'name email');
};

exports.createFeedback = async (ctx, articleId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const existing = await KnowledgeFeedback.findOne({ tenantId, articleId, userId: actor.userId, type: data.type, isDeleted: false });
  if (existing) throw Object.assign(new Error('Feedback already submitted'), { statusCode: 422 });
  const feedback = await KnowledgeFeedback.create({ ...data, tenantId, articleId, userId: actor.userId });
  const article = await Faq.findById(articleId);
  if (article) {
    article.feedbackCount = (article.feedbackCount || 0) + 1;
    if (data.type === 'helpful') article.helpful = (article.helpful || 0) + 1;
    else if (data.type === 'not_helpful') article.notHelpful = (article.notHelpful || 0) + 1;
    await article.save();
  }
  return feedback;
};

exports.respondToFeedback = async (ctx, feedbackId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const feedback = await KnowledgeFeedback.findOne({ _id: feedbackId, tenantId, isDeleted: false });
  if (!feedback) throw Object.assign(new Error('Feedback not found'), { statusCode: 404 });
  feedback.respondedBy = actor.userId;
  feedback.respondedAt = new Date();
  feedback.response = data.response;
  feedback.responseAction = data.responseAction || 'acknowledged';
  await feedback.save();
  return feedback;
};

// ─── Ratings ────────────────────────────────────────────────────────────

exports.rateArticle = async (ctx, articleId, rating, actor) => {
  const tenantId = requireTenant(ctx);
  if (rating < 1 || rating > 5) throw Object.assign(new Error('Rating must be 1-5'), { statusCode: 422 });
  const existing = await KnowledgeRating.findOne({ tenantId, articleId, userId: actor.userId });
  if (existing) {
    existing.rating = rating;
    await existing.save();
  } else {
    await KnowledgeRating.create({ tenantId, articleId, userId: actor.userId, rating });
  }
  // Recalculate average
  const ratings = await KnowledgeRating.find({ tenantId, articleId });
  const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  const article = await Faq.findById(articleId);
  if (article) {
    article.averageRating = Math.round(avg * 10) / 10;
    article.ratingCount = ratings.length;
    await article.save();
  }
  return { averageRating: article.averageRating, ratingCount: article.ratingCount };
};

exports.getArticleRatings = async (ctx, articleId) => {
  const tenantId = requireTenant(ctx);
  const ratings = await KnowledgeRating.find({ tenantId, articleId });
  const avg = ratings.length ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;
  const distribution = [0, 0, 0, 0, 0];
  ratings.forEach(r => { distribution[r.rating - 1]++; });
  return { averageRating: Math.round(avg * 10) / 10, ratingCount: ratings.length, distribution };
};

// ─── Comments ───────────────────────────────────────────────────────────

exports.listComments = async (ctx, articleId, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, articleId, isDeleted: false, status: 'visible', parentId: null, ...pick(query, ['isInternal']) };
  return KnowledgeComment.find(filter).sort({ createdAt: -1 }).populate('userId', 'name email');
};

exports.listCommentReplies = async (ctx, commentId) => {
  const tenantId = requireTenant(ctx);
  return KnowledgeComment.find({ tenantId, parentId: commentId, isDeleted: false, status: 'visible' }).sort({ createdAt: 1 }).populate('userId', 'name email');
};

exports.createComment = async (ctx, articleId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const comment = await KnowledgeComment.create({ ...data, tenantId, articleId, userId: actor.userId });
  const article = await Faq.findById(articleId);
  if (article) {
    article.commentCount = (article.commentCount || 0) + 1;
    await article.save();
  }
  return comment;
};

exports.updateComment = async (ctx, commentId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const comment = await KnowledgeComment.findOne({ _id: commentId, tenantId, isDeleted: false });
  if (!comment) throw Object.assign(new Error('Comment not found'), { statusCode: 404 });
  if (!comment.userId.equals(actor.userId)) throw Object.assign(new Error('Not your comment'), { statusCode: 403 });
  comment.content = data.content;
  await comment.save();
  return comment;
};

exports.deleteComment = async (ctx, commentId, actor) => {
  const tenantId = requireTenant(ctx);
  const comment = await KnowledgeComment.findOne({ _id: commentId, tenantId, isDeleted: false });
  if (!comment) throw Object.assign(new Error('Comment not found'), { statusCode: 404 });
  comment.isDeleted = true;
  comment.deletedAt = new Date();
  comment.deletedBy = actor.userId;
  await comment.save();
  const article = await Faq.findById(comment.articleId);
  if (article && article.commentCount > 0) {
    article.commentCount--;
    await article.save();
  }
  return { success: true };
};

exports.moderateComment = async (ctx, commentId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const comment = await KnowledgeComment.findOne({ _id: commentId, tenantId, isDeleted: false });
  if (!comment) throw Object.assign(new Error('Comment not found'), { statusCode: 404 });
  comment.status = data.status;
  comment.moderatedBy = actor.userId;
  comment.moderatedAt = new Date();
  comment.moderationReason = data.reason;
  await comment.save();
  return comment;
};

exports.reactToComment = async (ctx, commentId, reactionType, actor) => {
  const tenantId = requireTenant(ctx);
  const comment = await KnowledgeComment.findOne({ _id: commentId, tenantId, isDeleted: false });
  if (!comment) throw Object.assign(new Error('Comment not found'), { statusCode: 404 });
  const existing = comment.reactions.find(r => r.userId.equals(actor.userId) && r.type === reactionType);
  if (existing) {
    comment.reactions = comment.reactions.filter(r => !(r.userId.equals(actor.userId) && r.type === reactionType));
  } else {
    comment.reactions.push({ userId: actor.userId, type: reactionType, createdAt: new Date() });
  }
  await comment.save();
  return comment;
};

// ─── Reader/Contributor Criteria ────────────────────────────────────────

exports.listReaderCriteria = async (ctx, articleId) => {
  const tenantId = requireTenant(ctx);
  return KnowledgeReaderCriteria.find({ tenantId, articleId, isDeleted: false }).sort({ priority: 1 });
};

exports.createReaderCriteria = async (ctx, articleId, data, actor) => {
  const tenantId = requireTenant(ctx);
  return KnowledgeReaderCriteria.create({ ...data, tenantId, articleId, createdBy: actor.userId });
};

exports.updateReaderCriteria = async (ctx, criteriaId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const criteria = await KnowledgeReaderCriteria.findOne({ _id: criteriaId, tenantId, isDeleted: false });
  if (!criteria) throw Object.assign(new Error('Criteria not found'), { statusCode: 404 });
  const allowed = ['criteriaType', 'roles', 'groups', 'departments', 'organizations', 'users', 'companies', 'matchAll', 'priority', 'isActive'];
  Object.assign(criteria, pick(data, allowed));
  await criteria.save();
  return criteria;
};

exports.deleteReaderCriteria = async (ctx, criteriaId, actor) => {
  const tenantId = requireTenant(ctx);
  const criteria = await KnowledgeReaderCriteria.findOne({ _id: criteriaId, tenantId, isDeleted: false });
  if (!criteria) throw Object.assign(new Error('Criteria not found'), { statusCode: 404 });
  criteria.isDeleted = true;
  criteria.deletedAt = new Date();
  criteria.deletedBy = actor.userId;
  await criteria.save();
  return { success: true };
};

exports.listContributorCriteria = async (ctx, articleId) => {
  const tenantId = requireTenant(ctx);
  return KnowledgeContributorCriteria.find({ tenantId, articleId, isDeleted: false }).sort({ priority: 1 });
};

exports.createContributorCriteria = async (ctx, articleId, data, actor) => {
  const tenantId = requireTenant(ctx);
  return KnowledgeContributorCriteria.create({ ...data, tenantId, articleId, createdBy: actor.userId });
};

exports.deleteContributorCriteria = async (ctx, criteriaId, actor) => {
  const tenantId = requireTenant(ctx);
  const criteria = await KnowledgeContributorCriteria.findOne({ _id: criteriaId, tenantId, isDeleted: false });
  if (!criteria) throw Object.assign(new Error('Criteria not found'), { statusCode: 404 });
  criteria.isDeleted = true;
  criteria.deletedAt = new Date();
  criteria.deletedBy = actor.userId;
  await criteria.save();
  return { success: true };
};

// ─── Approvals ──────────────────────────────────────────────────────────

exports.listApprovals = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['articleId', 'status', 'approver']) };
  return KnowledgeApproval.find(filter).sort({ createdAt: -1 });
};

exports.createApproval = async (ctx, articleId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const article = await Faq.findOne({ _id: articleId, company: tenantId });
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  const approval = await KnowledgeApproval.create({
    ...data, tenantId, articleId, version: article.version,
    requestedBy: actor.userId, requestedAt: new Date(),
  });
  return approval;
};

exports.decideApproval = async (ctx, approvalId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const approval = await KnowledgeApproval.findOne({ _id: approvalId, tenantId, isDeleted: false });
  if (!approval) throw Object.assign(new Error('Approval not found'), { statusCode: 404 });
  if (approval.status !== 'pending') throw Object.assign(new Error('Already decided'), { statusCode: 422 });
  approval.status = data.decision;
  approval.decidedBy = actor.userId;
  approval.decidedAt = new Date();
  approval.comment = data.comment;
  await approval.save();
  if (data.decision === 'approved') {
    await exports.transitionArticle(ctx, approval.articleId, 'approved', { reason: data.comment }, actor);
  }
  return approval;
};

// ─── Search & Metrics ───────────────────────────────────────────────────

exports.searchArticles = async (ctx, query, userId) => {
  const tenantId = requireTenant(ctx);
  const filter = { company: tenantId, lifecycle: 'published', isPublished: true };
  if (query) filter.$or = [
    { question: { $regex: query, $options: 'i' } },
    { answer: { $regex: query, $options: 'i' } },
    { keywords: { $in: [new RegExp(query, 'i')] } },
  ];
  const articles = await Faq.find(filter).limit(20).populate('category', 'name');
  // Increment search analytics
  for (const a of articles) {
    a.analytics = a.analytics || {};
    a.analytics.searches = (a.analytics.searches || 0) + 1;
    await a.save();
  }
  return articles;
};

exports.getArticleMetrics = async (ctx, articleId) => {
  const tenantId = requireTenant(ctx);
  const article = await Faq.findOne({ _id: articleId, company: tenantId });
  if (!article) throw Object.assign(new Error('Article not found'), { statusCode: 404 });
  const feedback = await KnowledgeFeedback.countDocuments({ tenantId, articleId, isDeleted: false });
  const ratings = await KnowledgeRating.find({ tenantId, articleId });
  const avg = ratings.length ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;
  const comments = await KnowledgeComment.countDocuments({ tenantId, articleId, isDeleted: false, status: 'visible' });
  return {
    views: article.views || 0,
    helpful: article.helpful || 0,
    notHelpful: article.notHelpful || 0,
    searches: article.analytics?.searches || 0,
    averageRating: Math.round(avg * 10) / 10,
    ratingCount: ratings.length,
    feedbackCount: feedback,
    commentCount: comments,
  };
};

exports.getKBDashboard = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const [total, published, draft, review, expired, archived] = await Promise.all([
    Faq.countDocuments({ company: tenantId }),
    Faq.countDocuments({ company: tenantId, lifecycle: 'published' }),
    Faq.countDocuments({ company: tenantId, lifecycle: 'draft' }),
    Faq.countDocuments({ company: tenantId, lifecycle: 'review' }),
    Faq.countDocuments({ company: tenantId, lifecycle: 'expired' }),
    Faq.countDocuments({ company: tenantId, lifecycle: 'archived' }),
  ]);
  const topViewed = await Faq.find({ company: tenantId }).sort({ views: -1 }).limit(5).select('question views helpful');
  const topRated = await Faq.find({ company: tenantId, averageRating: { $gt: 0 } }).sort({ averageRating: -1 }).limit(5).select('question averageRating ratingCount');
  const recentFeedback = await KnowledgeFeedback.find({ tenantId, isDeleted: false }).sort({ createdAt: -1 }).limit(10).populate('articleId', 'question').populate('userId', 'name');
  return { total, published, draft, review, expired, archived, topViewed, topRated, recentFeedback };
};
