const router = require('express').Router();
const ctrl = require('../../controllers/core/approvalEngine.controller');
const { protectTenantPrincipal } = require('../../middleware/auth');

// ─── Definitions ────────────────────────────────────────────────────────
router.get('/definitions', protectTenantPrincipal, ctrl.listDefinitions);
router.get('/definitions/:id', protectTenantPrincipal, ctrl.getDefinition);
router.post('/definitions', protectTenantPrincipal, ctrl.createDefinition);
router.put('/definitions/:id', protectTenantPrincipal, ctrl.updateDefinition);
router.delete('/definitions/:id', protectTenantPrincipal, ctrl.deleteDefinition);
router.post('/evaluate', protectTenantPrincipal, ctrl.evaluatePolicy);

// ─── Instances ──────────────────────────────────────────────────────────
router.get('/instances', protectTenantPrincipal, ctrl.listInstances);
router.get('/instances/:id', protectTenantPrincipal, ctrl.getInstance);
router.get('/instances/:id/detail', protectTenantPrincipal, ctrl.getInstanceWithSteps);
router.post('/instances', protectTenantPrincipal, ctrl.createInstance);
router.post('/instances/:id/steps/:stepId/decide', protectTenantPrincipal, ctrl.decide);
router.post('/instances/:id/batch-decide', protectTenantPrincipal, ctrl.batchDecide);

// ─── Delegations ────────────────────────────────────────────────────────
router.get('/delegations', protectTenantPrincipal, ctrl.listDelegations);
router.post('/delegations', protectTenantPrincipal, ctrl.createDelegation);
router.put('/delegations/:id', protectTenantPrincipal, ctrl.updateDelegation);
router.delete('/delegations/:id', protectTenantPrincipal, ctrl.deleteDelegation);

// ─── Decisions / History ────────────────────────────────────────────────
router.get('/instances/:instanceId/decisions', protectTenantPrincipal, ctrl.getDecisionHistory);
router.get('/decisions', protectTenantPrincipal, ctrl.getRecentDecisions);

// ─── Pending / Dashboard / Stats ────────────────────────────────────────
router.get('/pending', protectTenantPrincipal, ctrl.getPendingForUser);
router.get('/dashboard', protectTenantPrincipal, ctrl.getDashboard);
router.get('/stats', protectTenantPrincipal, ctrl.getStats);

// ─── Admin triggers ─────────────────────────────────────────────────────
router.post('/process-timeouts', protectTenantPrincipal, ctrl.processTimeouts);
router.post('/process-escalations', protectTenantPrincipal, ctrl.processEscalations);

module.exports = router;
