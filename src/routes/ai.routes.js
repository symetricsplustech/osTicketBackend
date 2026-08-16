const express = require('express');
const { protectAgent } = require('../middleware/auth');
const ctrl = require('../controllers/ai.controller');

const router = express.Router();

// All AI endpoints require an agent session
router.get('/intelligence/:number', protectAgent, ctrl.intelligence);
router.post('/intelligence/:number/refresh', protectAgent, ctrl.refreshIntelligence);
router.post('/assist/:number', protectAgent, ctrl.assist);
router.post('/summarize', protectAgent, ctrl.summarize);
router.post('/analyze', protectAgent, ctrl.analyze);
router.post('/rewrite', protectAgent, ctrl.rewrite);
router.post('/translate', protectAgent, ctrl.translate);
router.post('/handoff/:number', protectAgent, ctrl.handoff);
router.post('/resolution/:number', protectAgent, ctrl.resolution);
router.post('/qa/:number', protectAgent, ctrl.qa);
router.post('/reply-suggestions/:number', protectAgent, ctrl.replySuggestions);
router.post('/auto-resolve/preview/:number', protectAgent, ctrl.autoResolvePreview);
router.post('/auto-resolve/:number', protectAgent, ctrl.autoResolveTicket);
router.get('/kb-suggestions', protectAgent, ctrl.kbSuggestions);
router.post('/kb-drafts', protectAgent, ctrl.createDraftArticle);
router.put('/kb-articles/:id/review', protectAgent, ctrl.reviewArticle);
router.get('/qa-agents/:id', protectAgent, ctrl.qaAgent);

module.exports = router;