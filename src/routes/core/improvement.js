const router = require('express').Router();
const ctrl = require('../../controllers/core/improvement.controller');
const { protectTenantPrincipal, requirePermission } = require('../../middleware/auth');

// ─── Opportunities ────────────────────────────────────────────────────
router.get('/opportunities', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_opportunity.read"), ctrl.listOpportunities);
router.get('/opportunities/:id', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_opportunity.read"), ctrl.getOpportunity);
router.post('/opportunities', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_opportunity.create"), ctrl.createOpportunity);
router.put('/opportunities/:id', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_opportunity.update"), ctrl.updateOpportunity);
router.post('/opportunities/:id/transition', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_opportunity.update"), ctrl.transitionOpportunity);
router.delete('/opportunities/:id', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_opportunity.delete"), ctrl.deleteOpportunity);

// ─── Initiatives ──────────────────────────────────────────────────────
router.get('/initiatives', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_initiative.read"), ctrl.listInitiatives);
router.get('/initiatives/:id', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_initiative.read"), ctrl.getInitiative);
router.get('/initiatives/:id/detail', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_initiative.read"), ctrl.getInitiativeWithDetails);
router.post('/initiatives', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_initiative.create"), ctrl.createInitiative);
router.put('/initiatives/:id', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_initiative.update"), ctrl.updateInitiative);
router.post('/initiatives/:id/transition', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_initiative.update"), ctrl.transitionInitiative);
router.delete('/initiatives/:id', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_initiative.delete"), ctrl.deleteInitiative);

// ─── Tasks ────────────────────────────────────────────────────────────
router.get('/tasks', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_task.read"), ctrl.listTasks);
router.get('/tasks/:id', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_task.read"), ctrl.getTask);
router.post('/tasks', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_task.create"), ctrl.createTask);
router.put('/tasks/:id', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_task.update"), ctrl.updateTask);
router.post('/tasks/:id/transition', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_task.update"), ctrl.transitionTask);
router.delete('/tasks/:id', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_task.delete"), ctrl.deleteTask);

// ─── Goals ────────────────────────────────────────────────────────────
router.get('/goals', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_goal.read"), ctrl.listGoals);
router.get('/goals/:id', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_goal.read"), ctrl.getGoal);
router.post('/goals', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_goal.create"), ctrl.createGoal);
router.put('/goals/:id', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_goal.update"), ctrl.updateGoal);
router.post('/goals/:id/progress', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_goal.update"), ctrl.updateGoalProgress);
router.delete('/goals/:id', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_goal.delete"), ctrl.deleteGoal);

// ─── Benefits ─────────────────────────────────────────────────────────
router.get('/benefits', protectTenantPrincipal, requirePermission("itsm.improvement.benefit.read"), ctrl.listBenefits);
router.post('/benefits', protectTenantPrincipal, requirePermission("itsm.improvement.benefit.create"), ctrl.createBenefit);
router.put('/benefits/:id', protectTenantPrincipal, requirePermission("itsm.improvement.benefit.update"), ctrl.updateBenefit);
router.delete('/benefits/:id', protectTenantPrincipal, requirePermission("itsm.improvement.benefit.delete"), ctrl.deleteBenefit);

// ─── Costs ────────────────────────────────────────────────────────────
router.get('/costs', protectTenantPrincipal, requirePermission("itsm.improvement.cost.read"), ctrl.listCosts);
router.post('/costs', protectTenantPrincipal, requirePermission("itsm.improvement.cost.create"), ctrl.createCost);
router.put('/costs/:id', protectTenantPrincipal, requirePermission("itsm.improvement.cost.update"), ctrl.updateCost);
router.delete('/costs/:id', protectTenantPrincipal, requirePermission("itsm.improvement.cost.delete"), ctrl.deleteCost);

// ─── Metric Baselines ────────────────────────────────────────────────
router.get('/baselines', protectTenantPrincipal, requirePermission("itsm.improvement.metric_baseline.read"), ctrl.listBaselines);
router.post('/baselines', protectTenantPrincipal, requirePermission("itsm.improvement.metric_baseline.create"), ctrl.createBaseline);
router.put('/baselines/:id', protectTenantPrincipal, requirePermission("itsm.improvement.metric_baseline.update"), ctrl.updateBaseline);
router.delete('/baselines/:id', protectTenantPrincipal, requirePermission("itsm.improvement.metric_baseline.delete"), ctrl.deleteBaseline);

// ─── Metric Targets ──────────────────────────────────────────────────
router.get('/targets', protectTenantPrincipal, requirePermission("itsm.improvement.metric_target.read"), ctrl.listTargets);
router.get('/targets/:id', protectTenantPrincipal, requirePermission("itsm.improvement.metric_target.read"), ctrl.getTarget);
router.post('/targets', protectTenantPrincipal, requirePermission("itsm.improvement.metric_target.create"), ctrl.createTarget);
router.put('/targets/:id', protectTenantPrincipal, requirePermission("itsm.improvement.metric_target.update"), ctrl.updateTarget);
router.delete('/targets/:id', protectTenantPrincipal, requirePermission("itsm.improvement.metric_target.delete"), ctrl.deleteTarget);

// ─── Dashboard / Analytics ────────────────────────────────────────────
router.get('/dashboard', protectTenantPrincipal, requirePermission("itsm.improvement.view_dashboard"), ctrl.getDashboard);
router.get('/initiatives/:id/roi', protectTenantPrincipal, requirePermission("itsm.improvement.improvement_initiative.read"), ctrl.getInitiativeROI);

module.exports = router;
