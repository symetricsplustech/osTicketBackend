const router = require('express').Router();
const ctrl = require('../../controllers/core/improvement.controller');
const { protectTenantPrincipal } = require('../../middleware/auth');

// ─── Opportunities ────────────────────────────────────────────────────
router.get('/opportunities', protectTenantPrincipal, ctrl.listOpportunities);
router.get('/opportunities/:id', protectTenantPrincipal, ctrl.getOpportunity);
router.post('/opportunities', protectTenantPrincipal, ctrl.createOpportunity);
router.put('/opportunities/:id', protectTenantPrincipal, ctrl.updateOpportunity);
router.post('/opportunities/:id/transition', protectTenantPrincipal, ctrl.transitionOpportunity);
router.delete('/opportunities/:id', protectTenantPrincipal, ctrl.deleteOpportunity);

// ─── Initiatives ──────────────────────────────────────────────────────
router.get('/initiatives', protectTenantPrincipal, ctrl.listInitiatives);
router.get('/initiatives/:id', protectTenantPrincipal, ctrl.getInitiative);
router.get('/initiatives/:id/detail', protectTenantPrincipal, ctrl.getInitiativeWithDetails);
router.post('/initiatives', protectTenantPrincipal, ctrl.createInitiative);
router.put('/initiatives/:id', protectTenantPrincipal, ctrl.updateInitiative);
router.post('/initiatives/:id/transition', protectTenantPrincipal, ctrl.transitionInitiative);
router.delete('/initiatives/:id', protectTenantPrincipal, ctrl.deleteInitiative);

// ─── Tasks ────────────────────────────────────────────────────────────
router.get('/tasks', protectTenantPrincipal, ctrl.listTasks);
router.get('/tasks/:id', protectTenantPrincipal, ctrl.getTask);
router.post('/tasks', protectTenantPrincipal, ctrl.createTask);
router.put('/tasks/:id', protectTenantPrincipal, ctrl.updateTask);
router.post('/tasks/:id/transition', protectTenantPrincipal, ctrl.transitionTask);
router.delete('/tasks/:id', protectTenantPrincipal, ctrl.deleteTask);

// ─── Goals ────────────────────────────────────────────────────────────
router.get('/goals', protectTenantPrincipal, ctrl.listGoals);
router.get('/goals/:id', protectTenantPrincipal, ctrl.getGoal);
router.post('/goals', protectTenantPrincipal, ctrl.createGoal);
router.put('/goals/:id', protectTenantPrincipal, ctrl.updateGoal);
router.post('/goals/:id/progress', protectTenantPrincipal, ctrl.updateGoalProgress);
router.delete('/goals/:id', protectTenantPrincipal, ctrl.deleteGoal);

// ─── Benefits ─────────────────────────────────────────────────────────
router.get('/benefits', protectTenantPrincipal, ctrl.listBenefits);
router.post('/benefits', protectTenantPrincipal, ctrl.createBenefit);
router.put('/benefits/:id', protectTenantPrincipal, ctrl.updateBenefit);
router.delete('/benefits/:id', protectTenantPrincipal, ctrl.deleteBenefit);

// ─── Costs ────────────────────────────────────────────────────────────
router.get('/costs', protectTenantPrincipal, ctrl.listCosts);
router.post('/costs', protectTenantPrincipal, ctrl.createCost);
router.put('/costs/:id', protectTenantPrincipal, ctrl.updateCost);
router.delete('/costs/:id', protectTenantPrincipal, ctrl.deleteCost);

// ─── Metric Baselines ────────────────────────────────────────────────
router.get('/baselines', protectTenantPrincipal, ctrl.listBaselines);
router.post('/baselines', protectTenantPrincipal, ctrl.createBaseline);
router.put('/baselines/:id', protectTenantPrincipal, ctrl.updateBaseline);
router.delete('/baselines/:id', protectTenantPrincipal, ctrl.deleteBaseline);

// ─── Metric Targets ──────────────────────────────────────────────────
router.get('/targets', protectTenantPrincipal, ctrl.listTargets);
router.get('/targets/:id', protectTenantPrincipal, ctrl.getTarget);
router.post('/targets', protectTenantPrincipal, ctrl.createTarget);
router.put('/targets/:id', protectTenantPrincipal, ctrl.updateTarget);
router.delete('/targets/:id', protectTenantPrincipal, ctrl.deleteTarget);

// ─── Dashboard / Analytics ────────────────────────────────────────────
router.get('/dashboard', protectTenantPrincipal, ctrl.getDashboard);
router.get('/initiatives/:id/roi', protectTenantPrincipal, ctrl.getInitiativeROI);

module.exports = router;
