/**
 * Knowledge Management API routes — KB, articles, versions, feedback, ratings, comments, criteria, approvals.
 * Base: /core/knowledge/*
 */
const router = require('express').Router();
const ctrl = require('../../controllers/core/knowledge.controller');
const { protectTenantPrincipal, requirePermission, requireResolvedPermission } = require('../../middleware/auth');

// ─── Knowledge Bases ────────────────────────────────────────────────────
router.get('/bases', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_base.read'), ctrl.listKnowledgeBases);
router.get('/bases/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_base.read'), ctrl.getKnowledgeBase);
router.post('/bases', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_base.create'), ctrl.createKnowledgeBase);
router.put('/bases/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_base.update'), ctrl.updateKnowledgeBase);
router.delete('/bases/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_base.delete'), ctrl.deleteKnowledgeBase);

// ─── Categories ─────────────────────────────────────────────────────────
router.get('/categories', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_category.read'), ctrl.listCategories);
router.get('/categories/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_category.read'), ctrl.getCategory);
router.post('/categories', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_category.create'), ctrl.createCategory);
router.put('/categories/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_category.update'), ctrl.updateCategory);
router.delete('/categories/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_category.delete'), ctrl.deleteCategory);

// ─── Articles ───────────────────────────────────────────────────────────
router.get('/articles', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.read'), ctrl.listArticles);
router.get('/articles/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.read'), ctrl.getArticle);
router.post('/articles', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.create'), ctrl.createArticle);
router.put('/articles/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.update'), ctrl.updateArticle);
router.delete('/articles/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.delete'), ctrl.deleteArticle);
router.post('/articles/:id/transition', protectTenantPrincipal, requirePermission('itsm.knowledge.article_update'), ctrl.transitionArticle);

// ─── Versions ───────────────────────────────────────────────────────────
router.get('/articles/:articleId/versions', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.read'), ctrl.listVersions);
router.get('/versions/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_version.read'), ctrl.getVersion);
router.post('/articles/:articleId/versions/:versionId/restore', protectTenantPrincipal, requirePermission('itsm.knowledge.article_version'), ctrl.restoreVersion);

// ─── Feedback ───────────────────────────────────────────────────────────
router.get('/articles/:articleId/feedback', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.read'), ctrl.listFeedback);
router.post('/articles/:articleId/feedback', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_feedback.create'), ctrl.createFeedback);
router.post('/feedback/:id/respond', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_feedback.update'), ctrl.respondToFeedback);

// ─── Ratings ────────────────────────────────────────────────────────────
router.get('/articles/:articleId/ratings', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.read'), ctrl.getArticleRatings);
router.post('/articles/:articleId/rate', protectTenantPrincipal, requirePermission('itsm.knowledge.article_rate'), ctrl.rateArticle);

// ─── Comments ───────────────────────────────────────────────────────────
router.get('/articles/:articleId/comments', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.read'), ctrl.listComments);
router.post('/articles/:articleId/comments', protectTenantPrincipal, requirePermission('itsm.knowledge.article_comment'), ctrl.createComment);
router.get('/comments/:commentId/replies', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_comment.read'), ctrl.listCommentReplies);
router.put('/comments/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_comment.update'), ctrl.updateComment);
router.delete('/comments/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_comment.delete'), ctrl.deleteComment);
router.post('/comments/:id/moderate', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_comment.update'), ctrl.moderateComment);
router.post('/comments/:id/react', protectTenantPrincipal, requirePermission('itsm.knowledge.article_comment'), ctrl.reactToComment);

// ─── Reader Criteria ────────────────────────────────────────────────────
router.get('/articles/:articleId/reader-criteria', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.read'), ctrl.listReaderCriteria);
router.post('/articles/:articleId/reader-criteria', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_reader_criteria.create'), ctrl.createReaderCriteria);
router.put('/reader-criteria/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_reader_criteria.update'), ctrl.updateReaderCriteria);
router.delete('/reader-criteria/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_reader_criteria.delete'), ctrl.deleteReaderCriteria);

// ─── Contributor Criteria ───────────────────────────────────────────────
router.get('/articles/:articleId/contributor-criteria', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.read'), ctrl.listContributorCriteria);
router.post('/articles/:articleId/contributor-criteria', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_contributor_criteria.create'), ctrl.createContributorCriteria);
router.delete('/contributor-criteria/:id', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_contributor_criteria.delete'), ctrl.deleteContributorCriteria);

// ─── Approvals ──────────────────────────────────────────────────────────
router.get('/approvals', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_approval.read'), ctrl.listApprovals);
router.post('/articles/:articleId/approvals', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_approval.create'), ctrl.createApproval);
router.post('/approvals/:id/decide', protectTenantPrincipal, requireResolvedPermission((req) =>
  req.body.decision === 'rejected' ? 'itsm.knowledge.article_reject' :
    req.body.decision === 'approved' ? 'itsm.knowledge.article_approve' : null
), ctrl.decideApproval);

// ─── Search & Metrics ───────────────────────────────────────────────────
router.get('/search', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.read'), ctrl.searchArticles);
router.get('/articles/:articleId/metrics', protectTenantPrincipal, requirePermission('itsm.knowledge.analytics'), ctrl.getArticleMetrics);
router.get('/dashboard', protectTenantPrincipal, requirePermission('itsm.knowledge.knowledge_article.read'), ctrl.getKBDashboard);

module.exports = router;
