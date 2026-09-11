/**
 * Assignment / Routing API routes — /core/assignments/*
 */
const router = require('express').Router();
const ctrl = require('../../controllers/core/assignment.controller');
const { protectTenantPrincipal } = require('../../middleware/auth');

// ─── Assignment Rules ───────────────────────────────────────────────────
router.get('/rules', protectTenantPrincipal, ctrl.listRules);
router.get('/rules/:id', protectTenantPrincipal, ctrl.getRule);
router.post('/rules', protectTenantPrincipal, ctrl.createRule);
router.put('/rules/:id', protectTenantPrincipal, ctrl.updateRule);
router.delete('/rules/:id', protectTenantPrincipal, ctrl.deleteRule);

// ─── Queues ─────────────────────────────────────────────────────────────
router.get('/queues', protectTenantPrincipal, ctrl.listQueues);
router.get('/queues/:id', protectTenantPrincipal, ctrl.getQueue);
router.post('/queues', protectTenantPrincipal, ctrl.createQueue);
router.put('/queues/:id', protectTenantPrincipal, ctrl.updateQueue);
router.delete('/queues/:id', protectTenantPrincipal, ctrl.deleteQueue);
router.get('/queues/:id/stats', protectTenantPrincipal, ctrl.getQueueStats);

// ─── Skills ─────────────────────────────────────────────────────────────
router.get('/skills', protectTenantPrincipal, ctrl.listSkills);
router.get('/skills/:id', protectTenantPrincipal, ctrl.getSkill);
router.post('/skills', protectTenantPrincipal, ctrl.createSkill);
router.put('/skills/:id', protectTenantPrincipal, ctrl.updateSkill);
router.delete('/skills/:id', protectTenantPrincipal, ctrl.deleteSkill);

// ─── Agent Skills ───────────────────────────────────────────────────────
router.get('/agents/:agentId/skills', protectTenantPrincipal, ctrl.listAgentSkills);
router.post('/agents/:agentId/skills/:skillId', protectTenantPrincipal, ctrl.assignSkill);
router.delete('/agents/:agentId/skills/:skillId', protectTenantPrincipal, ctrl.removeSkill);

// ─── Presence ───────────────────────────────────────────────────────────
router.get('/agents/:agentId/presence', protectTenantPrincipal, ctrl.getPresence);
router.get('/agents/:agentId/presence/history', protectTenantPrincipal, ctrl.getPresenceHistory);
router.post('/agents/:agentId/presence', protectTenantPrincipal, ctrl.setPresence);
router.get('/presence/stats', protectTenantPrincipal, ctrl.getPresenceStats);

// ─── Capacity ───────────────────────────────────────────────────────────
router.get('/agents/:agentId/capacity', protectTenantPrincipal, ctrl.getCapacity);
router.get('/capacity/stats', protectTenantPrincipal, ctrl.getCapacityStats);
router.put('/agents/:agentId/capacity', protectTenantPrincipal, ctrl.updateCapacity);
router.post('/agents/:agentId/capacity/recalculate', protectTenantPrincipal, ctrl.recalculateCapacity);

// ─── Routing Rules ──────────────────────────────────────────────────────
router.get('/routing-rules', protectTenantPrincipal, ctrl.listRoutingRules);
router.get('/routing-rules/:id', protectTenantPrincipal, ctrl.getRoutingRule);
router.post('/routing-rules', protectTenantPrincipal, ctrl.createRoutingRule);
router.put('/routing-rules/:id', protectTenantPrincipal, ctrl.updateRoutingRule);
router.delete('/routing-rules/:id', protectTenantPrincipal, ctrl.deleteRoutingRule);

// ─── Assignment Events / History ────────────────────────────────────────
router.get('/history/ticket/:ticketId', protectTenantPrincipal, ctrl.getHistory);
router.get('/history/number/:ticketNumber', protectTenantPrincipal, ctrl.getHistoryByNumber);
router.get('/events', protectTenantPrincipal, ctrl.getRecentEvents);

// ─── Core Logic ─────────────────────────────────────────────────────────
router.post('/evaluate', protectTenantPrincipal, ctrl.evaluateRules);
router.post('/evaluate-routing', protectTenantPrincipal, ctrl.evaluateRoutingRules);
router.post('/find-agent', protectTenantPrincipal, ctrl.findBestAgent);
router.post('/diagnose', protectTenantPrincipal, ctrl.diagnose);

// ─── Work Offer ─────────────────────────────────────────────────────────
router.post('/tickets/:ticketId/offer', protectTenantPrincipal, ctrl.offerWork);
router.post('/tickets/:ticketId/offer/:agentId/accept', protectTenantPrincipal, ctrl.acceptWork);
router.post('/tickets/:ticketId/offer/:agentId/decline', protectTenantPrincipal, ctrl.declineWork);

// ─── Dashboard ──────────────────────────────────────────────────────────
router.get('/dashboard', protectTenantPrincipal, ctrl.getDashboard);

module.exports = router;
