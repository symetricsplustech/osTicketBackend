/**
 * Assignment / Routing API routes — /core/assignments/*
 */
const router = require('express').Router();
const ctrl = require('../../controllers/core/assignment.controller');
const { protectTenantPrincipal, requirePermission } = require('../../middleware/auth');

// ─── Assignment Rules ───────────────────────────────────────────────────
router.get('/rules', protectTenantPrincipal, requirePermission('itsm.assignment.assignment_rule.read'), ctrl.listRules);
router.get('/rules/:id', protectTenantPrincipal, requirePermission('itsm.assignment.assignment_rule.read'), ctrl.getRule);
router.post('/rules', protectTenantPrincipal, requirePermission('itsm.assignment.assignment_rule.create'), ctrl.createRule);
router.put('/rules/:id', protectTenantPrincipal, requirePermission('itsm.assignment.assignment_rule.update'), ctrl.updateRule);
router.delete('/rules/:id', protectTenantPrincipal, requirePermission('itsm.assignment.assignment_rule.delete'), ctrl.deleteRule);

// ─── Queues ─────────────────────────────────────────────────────────────
router.get('/queues', protectTenantPrincipal, requirePermission('itsm.assignment.queue.read'), ctrl.listQueues);
router.get('/queues/:id', protectTenantPrincipal, requirePermission('itsm.assignment.queue.read'), ctrl.getQueue);
router.post('/queues', protectTenantPrincipal, requirePermission('itsm.assignment.queue.create'), ctrl.createQueue);
router.put('/queues/:id', protectTenantPrincipal, requirePermission('itsm.assignment.queue.update'), ctrl.updateQueue);
router.delete('/queues/:id', protectTenantPrincipal, requirePermission('itsm.assignment.queue.delete'), ctrl.deleteQueue);
router.get('/queues/:id/stats', protectTenantPrincipal, requirePermission('itsm.assignment.queue_read'), ctrl.getQueueStats);

// ─── Skills ─────────────────────────────────────────────────────────────
router.get('/skills', protectTenantPrincipal, requirePermission('itsm.assignment.skill.read'), ctrl.listSkills);
router.get('/skills/:id', protectTenantPrincipal, requirePermission('itsm.assignment.skill.read'), ctrl.getSkill);
router.post('/skills', protectTenantPrincipal, requirePermission('itsm.assignment.skill.create'), ctrl.createSkill);
router.put('/skills/:id', protectTenantPrincipal, requirePermission('itsm.assignment.skill.update'), ctrl.updateSkill);
router.delete('/skills/:id', protectTenantPrincipal, requirePermission('itsm.assignment.skill.delete'), ctrl.deleteSkill);

// ─── Agent Skills ───────────────────────────────────────────────────────
router.get('/agents/:agentId/skills', protectTenantPrincipal, requirePermission('itsm.assignment.agent_skill.read'), ctrl.listAgentSkills);
router.post('/agents/:agentId/skills/:skillId', protectTenantPrincipal, requirePermission('itsm.assignment.skill_assign'), ctrl.assignSkill);
router.delete('/agents/:agentId/skills/:skillId', protectTenantPrincipal, requirePermission('itsm.assignment.skill_assign'), ctrl.removeSkill);

// ─── Presence ───────────────────────────────────────────────────────────
router.get('/agents/:agentId/presence', protectTenantPrincipal, requirePermission('itsm.assignment.presence_read_team'), ctrl.getPresence);
router.get('/agents/:agentId/presence/history', protectTenantPrincipal, requirePermission('itsm.assignment.view_assignment_history'), ctrl.getPresenceHistory);
router.post('/agents/:agentId/presence', protectTenantPrincipal, requirePermission('itsm.assignment.presence_update_own'), ctrl.setPresence);
router.get('/presence/stats', protectTenantPrincipal, requirePermission('itsm.assignment.queue_read'), ctrl.getPresenceStats);

// ─── Capacity ───────────────────────────────────────────────────────────
router.get('/agents/:agentId/capacity', protectTenantPrincipal, requirePermission('itsm.assignment.capacity_read_team'), ctrl.getCapacity);
router.get('/capacity/stats', protectTenantPrincipal, requirePermission('itsm.assignment.queue_read'), ctrl.getCapacityStats);
router.put('/agents/:agentId/capacity', protectTenantPrincipal, requirePermission('itsm.assignment.capacity_configure'), ctrl.updateCapacity);
router.post('/agents/:agentId/capacity/recalculate', protectTenantPrincipal, requirePermission('itsm.assignment.capacity_configure'), ctrl.recalculateCapacity);

// ─── Routing Rules ──────────────────────────────────────────────────────
router.get('/routing-rules', protectTenantPrincipal, requirePermission('itsm.assignment.routing_rule.read'), ctrl.listRoutingRules);
router.get('/routing-rules/:id', protectTenantPrincipal, requirePermission('itsm.assignment.routing_rule.read'), ctrl.getRoutingRule);
router.post('/routing-rules', protectTenantPrincipal, requirePermission('itsm.assignment.routing_rule.create'), ctrl.createRoutingRule);
router.put('/routing-rules/:id', protectTenantPrincipal, requirePermission('itsm.assignment.routing_rule.update'), ctrl.updateRoutingRule);
router.delete('/routing-rules/:id', protectTenantPrincipal, requirePermission('itsm.assignment.routing_rule.delete'), ctrl.deleteRoutingRule);

// ─── Assignment Events / History ────────────────────────────────────────
router.get('/history/ticket/:ticketId', protectTenantPrincipal, requirePermission('itsm.assignment.view_assignment_history'), ctrl.getHistory);
router.get('/history/number/:ticketNumber', protectTenantPrincipal, requirePermission('itsm.assignment.view_assignment_history'), ctrl.getHistoryByNumber);
router.get('/events', protectTenantPrincipal, requirePermission('itsm.assignment.view_assignment_history'), ctrl.getRecentEvents);

// ─── Core Logic ─────────────────────────────────────────────────────────
router.post('/evaluate', protectTenantPrincipal, requirePermission('itsm.assignment.routing_test'), ctrl.evaluateRules);
router.post('/evaluate-routing', protectTenantPrincipal, requirePermission('itsm.assignment.routing_test'), ctrl.evaluateRoutingRules);
router.post('/find-agent', protectTenantPrincipal, requirePermission('itsm.assignment.routing_read'), ctrl.findBestAgent);
router.post('/diagnose', protectTenantPrincipal, requirePermission('itsm.assignment.routing_test'), ctrl.diagnose);

// ─── Work Offer ─────────────────────────────────────────────────────────
router.post('/tickets/:ticketId/offer', protectTenantPrincipal, requirePermission('itsm.assignment.agent_assign'), ctrl.offerWork);
router.post('/tickets/:ticketId/offer/:agentId/accept', protectTenantPrincipal, requirePermission('itsm.assignment.work_offer_accept'), ctrl.acceptWork);
router.post('/tickets/:ticketId/offer/:agentId/decline', protectTenantPrincipal, requirePermission('itsm.assignment.work_offer_decline'), ctrl.declineWork);

// ─── Dashboard ──────────────────────────────────────────────────────────
router.get('/dashboard', protectTenantPrincipal, requirePermission('itsm.assignment.queue_read'), ctrl.getDashboard);

module.exports = router;
