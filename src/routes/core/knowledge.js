/**
 * Knowledge Management API routes — KB, articles, versions, feedback, ratings, comments, criteria, approvals.
 * Base: /core/knowledge/*
 */
const router = require('express').Router();
const ctrl = require('../../controllers/core/knowledge.controller');
const { protectTenantPrincipal } = require('../../middleware/auth');

// ─── Knowledge Bases ────────────────────────────────────────────────────
router.get('/bases', protectTenantPrincipal, ctrl.listKnowledgeBases);
router.get('/bases/:id', protectTenantPrincipal, ctrl.getKnowledgeBase);
router.post('/bases', protectTenantPrincipal, ctrl.createKnowledgeBase);
router.put('/bases/:id', protectTenantPrincipal, ctrl.updateKnowledgeBase);
router.delete('/bases/:id', protectTenantPrincipal, ctrl.deleteKnowledgeBase);

// ─── Categories ─────────────────────────────────────────────────────────
router.get('/categories', protectTenantPrincipal, ctrl.listCategories);
router.get('/categories/:id', protectTenantPrincipal, ctrl.getCategory);
router.post('/categories', protectTenantPrincipal, ctrl.createCategory);
router.put('/categories/:id', protectTenantPrincipal, ctrl.updateCategory);
router.delete('/categories/:id', protectTenantPrincipal, ctrl.deleteCategory);

// ─── Articles ───────────────────────────────────────────────────────────
router.get('/articles', protectTenantPrincipal, ctrl.listArticles);
router.get('/articles/:id', protectTenantPrincipal, ctrl.getArticle);
router.post('/articles', protectTenantPrincipal, ctrl.createArticle);
router.put('/articles/:id', protectTenantPrincipal, ctrl.updateArticle);
router.delete('/articles/:id', protectTenantPrincipal, ctrl.deleteArticle);
router.post('/articles/:id/transition', protectTenantPrincipal, ctrl.transitionArticle);

// ─── Versions ───────────────────────────────────────────────────────────
router.get('/articles/:articleId/versions', protectTenantPrincipal, ctrl.listVersions);
router.get('/versions/:id', protectTenantPrincipal, ctrl.getVersion);
router.post('/articles/:articleId/versions/:versionId/restore', protectTenantPrincipal, ctrl.restoreVersion);

// ─── Feedback ───────────────────────────────────────────────────────────
router.get('/articles/:articleId/feedback', protectTenantPrincipal, ctrl.listFeedback);
router.post('/articles/:articleId/feedback', protectTenantPrincipal, ctrl.createFeedback);
router.post('/feedback/:id/respond', protectTenantPrincipal, ctrl.respondToFeedback);

// ─── Ratings ────────────────────────────────────────────────────────────
router.get('/articles/:articleId/ratings', protectTenantPrincipal, ctrl.getArticleRatings);
router.post('/articles/:articleId/rate', protectTenantPrincipal, ctrl.rateArticle);

// ─── Comments ───────────────────────────────────────────────────────────
router.get('/articles/:articleId/comments', protectTenantPrincipal, ctrl.listComments);
router.post('/articles/:articleId/comments', protectTenantPrincipal, ctrl.createComment);
router.get('/comments/:commentId/replies', protectTenantPrincipal, ctrl.listCommentReplies);
router.put('/comments/:id', protectTenantPrincipal, ctrl.updateComment);
router.delete('/comments/:id', protectTenantPrincipal, ctrl.deleteComment);
router.post('/comments/:id/moderate', protectTenantPrincipal, ctrl.moderateComment);
router.post('/comments/:id/react', protectTenantPrincipal, ctrl.reactToComment);

// ─── Reader Criteria ────────────────────────────────────────────────────
router.get('/articles/:articleId/reader-criteria', protectTenantPrincipal, ctrl.listReaderCriteria);
router.post('/articles/:articleId/reader-criteria', protectTenantPrincipal, ctrl.createReaderCriteria);
router.put('/reader-criteria/:id', protectTenantPrincipal, ctrl.updateReaderCriteria);
router.delete('/reader-criteria/:id', protectTenantPrincipal, ctrl.deleteReaderCriteria);

// ─── Contributor Criteria ───────────────────────────────────────────────
router.get('/articles/:articleId/contributor-criteria', protectTenantPrincipal, ctrl.listContributorCriteria);
router.post('/articles/:articleId/contributor-criteria', protectTenantPrincipal, ctrl.createContributorCriteria);
router.delete('/contributor-criteria/:id', protectTenantPrincipal, ctrl.deleteContributorCriteria);

// ─── Approvals ──────────────────────────────────────────────────────────
router.get('/approvals', protectTenantPrincipal, ctrl.listApprovals);
router.post('/articles/:articleId/approvals', protectTenantPrincipal, ctrl.createApproval);
router.post('/approvals/:id/decide', protectTenantPrincipal, ctrl.decideApproval);

// ─── Search & Metrics ───────────────────────────────────────────────────
router.get('/search', protectTenantPrincipal, ctrl.searchArticles);
router.get('/articles/:articleId/metrics', protectTenantPrincipal, ctrl.getArticleMetrics);
router.get('/dashboard', protectTenantPrincipal, ctrl.getKBDashboard);

module.exports = router;
