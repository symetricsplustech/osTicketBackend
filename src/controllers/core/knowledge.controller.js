/**
 * Knowledge Management controller — HTTP layer for KB, articles, versions,
 * feedback, ratings, comments, criteria, approvals.
 */
const knowledgeService = require('../../services/knowledgeService');

// ─── Knowledge Bases ────────────────────────────────────────────────────

exports.listKnowledgeBases = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.listKnowledgeBases({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); }
};
exports.getKnowledgeBase = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.getKnowledgeBase({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); }
};
exports.createKnowledgeBase = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await knowledgeService.createKnowledgeBase({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); }
};
exports.updateKnowledgeBase = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.updateKnowledgeBase({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); }
};
exports.deleteKnowledgeBase = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.deleteKnowledgeBase({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); }
};

// ─── Categories ─────────────────────────────────────────────────────────

exports.listCategories = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.listCategories({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); }
};
exports.getCategory = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.getCategory({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); }
};
exports.createCategory = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await knowledgeService.createCategory({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); }
};
exports.updateCategory = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.updateCategory({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); }
};
exports.deleteCategory = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.deleteCategory({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); }
};

// ─── Articles ───────────────────────────────────────────────────────────

exports.listArticles = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.listArticles({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); }
};
exports.getArticle = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.getArticle({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); }
};
exports.createArticle = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await knowledgeService.createArticle({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); }
};
exports.updateArticle = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.updateArticle({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); }
};
exports.deleteArticle = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.deleteArticle({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); }
};
exports.transitionArticle = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.transitionArticle({ tenantId: req.tenantId }, req.params.id, req.body.lifecycle, req.body, req.user) }); } catch (e) { next(e); }
};

// ─── Versions ───────────────────────────────────────────────────────────

exports.listVersions = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.listVersions({ tenantId: req.tenantId }, req.params.articleId) }); } catch (e) { next(e); }
};
exports.getVersion = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.getVersion({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); }
};
exports.restoreVersion = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.restoreVersion({ tenantId: req.tenantId }, req.params.articleId, req.params.versionId, req.user) }); } catch (e) { next(e); }
};

// ─── Feedback ───────────────────────────────────────────────────────────

exports.listFeedback = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.listFeedback({ tenantId: req.tenantId }, req.params.articleId, req.query) }); } catch (e) { next(e); }
};
exports.createFeedback = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await knowledgeService.createFeedback({ tenantId: req.tenantId }, req.params.articleId, req.body, req.user) }); } catch (e) { next(e); }
};
exports.respondToFeedback = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.respondToFeedback({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); }
};

// ─── Ratings ────────────────────────────────────────────────────────────

exports.rateArticle = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.rateArticle({ tenantId: req.tenantId }, req.params.articleId, req.body.rating, req.user) }); } catch (e) { next(e); }
};
exports.getArticleRatings = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.getArticleRatings({ tenantId: req.tenantId }, req.params.articleId) }); } catch (e) { next(e); }
};

// ─── Comments ───────────────────────────────────────────────────────────

exports.listComments = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.listComments({ tenantId: req.tenantId }, req.params.articleId, req.query) }); } catch (e) { next(e); }
};
exports.listCommentReplies = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.listCommentReplies({ tenantId: req.tenantId }, req.params.commentId) }); } catch (e) { next(e); }
};
exports.createComment = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await knowledgeService.createComment({ tenantId: req.tenantId }, req.params.articleId, req.body, req.user) }); } catch (e) { next(e); }
};
exports.updateComment = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.updateComment({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); }
};
exports.deleteComment = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.deleteComment({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); }
};
exports.moderateComment = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.moderateComment({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); }
};
exports.reactToComment = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.reactToComment({ tenantId: req.tenantId }, req.params.id, req.body.type, req.user) }); } catch (e) { next(e); }
};

// ─── Reader/Contributor Criteria ────────────────────────────────────────

exports.listReaderCriteria = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.listReaderCriteria({ tenantId: req.tenantId }, req.params.articleId) }); } catch (e) { next(e); }
};
exports.createReaderCriteria = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await knowledgeService.createReaderCriteria({ tenantId: req.tenantId }, req.params.articleId, req.body, req.user) }); } catch (e) { next(e); }
};
exports.updateReaderCriteria = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.updateReaderCriteria({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); }
};
exports.deleteReaderCriteria = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.deleteReaderCriteria({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); }
};
exports.listContributorCriteria = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.listContributorCriteria({ tenantId: req.tenantId }, req.params.articleId) }); } catch (e) { next(e); }
};
exports.createContributorCriteria = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await knowledgeService.createContributorCriteria({ tenantId: req.tenantId }, req.params.articleId, req.body, req.user) }); } catch (e) { next(e); }
};
exports.deleteContributorCriteria = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.deleteContributorCriteria({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); }
};

// ─── Approvals ──────────────────────────────────────────────────────────

exports.listApprovals = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.listApprovals({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); }
};
exports.createApproval = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await knowledgeService.createApproval({ tenantId: req.tenantId }, req.params.articleId, req.body, req.user) }); } catch (e) { next(e); }
};
exports.decideApproval = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.decideApproval({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); }
};

// ─── Search & Metrics ───────────────────────────────────────────────────

exports.searchArticles = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.searchArticles({ tenantId: req.tenantId }, req.query.q, req.user?.userId) }); } catch (e) { next(e); }
};
exports.getArticleMetrics = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.getArticleMetrics({ tenantId: req.tenantId }, req.params.articleId) }); } catch (e) { next(e); }
};
exports.getKBDashboard = async (req, res, next) => {
  try { res.json({ success: true, data: await knowledgeService.getKBDashboard({ tenantId: req.tenantId }) }); } catch (e) { next(e); }
};
