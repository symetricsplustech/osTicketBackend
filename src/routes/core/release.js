const router = require('express').Router();
const ctrl = require('../../controllers/core/release.controller');
const { protectTenantPrincipal } = require('../../middleware/auth');

// ─── Releases ──────────────────────────────────────────────────────────
router.get('/releases', protectTenantPrincipal, ctrl.listReleases);
router.get('/releases/:id', protectTenantPrincipal, ctrl.getRelease);
router.post('/releases', protectTenantPrincipal, ctrl.createRelease);
router.put('/releases/:id', protectTenantPrincipal, ctrl.updateRelease);
router.delete('/releases/:id', protectTenantPrincipal, ctrl.deleteRelease);
router.post('/releases/:id/transition', protectTenantPrincipal, ctrl.transitionRelease);

// ─── Phases ────────────────────────────────────────────────────────────
router.get('/releases/:releaseId/phases', protectTenantPrincipal, ctrl.listPhases);
router.get('/phases/:id', protectTenantPrincipal, ctrl.getPhase);
router.post('/releases/:releaseId/phases', protectTenantPrincipal, ctrl.createPhase);
router.put('/phases/:id', protectTenantPrincipal, ctrl.updatePhase);
router.delete('/phases/:id', protectTenantPrincipal, ctrl.deletePhase);

// ─── Tasks ─────────────────────────────────────────────────────────────
router.get('/tasks', protectTenantPrincipal, ctrl.listTasks);
router.get('/tasks/:id', protectTenantPrincipal, ctrl.getTask);
router.post('/tasks', protectTenantPrincipal, ctrl.createTask);
router.put('/tasks/:id', protectTenantPrincipal, ctrl.updateTask);
router.delete('/tasks/:id', protectTenantPrincipal, ctrl.deleteTask);
router.post('/tasks/:id/execute', protectTenantPrincipal, ctrl.executeTask);

// ─── Components ────────────────────────────────────────────────────────
router.get('/releases/:releaseId/components', protectTenantPrincipal, ctrl.listComponents);
router.get('/components/:id', protectTenantPrincipal, ctrl.getComponent);
router.post('/releases/:releaseId/components', protectTenantPrincipal, ctrl.createComponent);
router.put('/components/:id', protectTenantPrincipal, ctrl.updateComponent);
router.delete('/components/:id', protectTenantPrincipal, ctrl.deleteComponent);

// ─── Dependencies ──────────────────────────────────────────────────────
router.get('/releases/:releaseId/dependencies', protectTenantPrincipal, ctrl.listDependencies);
router.get('/dependencies/:id', protectTenantPrincipal, ctrl.getDependency);
router.post('/releases/:releaseId/dependencies', protectTenantPrincipal, ctrl.createDependency);
router.put('/dependencies/:id', protectTenantPrincipal, ctrl.updateDependency);
router.delete('/dependencies/:id', protectTenantPrincipal, ctrl.deleteDependency);

// ─── Approvals ─────────────────────────────────────────────────────────
router.get('/releases/:releaseId/approvals', protectTenantPrincipal, ctrl.listApprovals);
router.get('/approvals/:id', protectTenantPrincipal, ctrl.getApproval);
router.post('/releases/:releaseId/approvals', protectTenantPrincipal, ctrl.createApproval);
router.post('/approvals/:id/decide', protectTenantPrincipal, ctrl.decideApproval);
router.delete('/approvals/:id', protectTenantPrincipal, ctrl.deleteApproval);

// ─── Deployments ───────────────────────────────────────────────────────
router.get('/releases/:releaseId/deployments', protectTenantPrincipal, ctrl.listDeployments);
router.get('/deployments/:id', protectTenantPrincipal, ctrl.getDeployment);
router.post('/releases/:releaseId/deployments', protectTenantPrincipal, ctrl.createDeployment);
router.put('/deployments/:id', protectTenantPrincipal, ctrl.updateDeployment);
router.delete('/deployments/:id', protectTenantPrincipal, ctrl.deleteDeployment);
router.post('/deployments/:id/start', protectTenantPrincipal, ctrl.startDeployment);
router.post('/deployments/:id/complete', protectTenantPrincipal, ctrl.completeDeployment);
router.post('/deployments/:id/rollback', protectTenantPrincipal, ctrl.rollbackDeployment);

// ─── Change Association ────────────────────────────────────────────────
router.post('/releases/:releaseId/changes', protectTenantPrincipal, ctrl.associateChange);
router.delete('/releases/:releaseId/changes/:changeId', protectTenantPrincipal, ctrl.removeChange);

// ─── Dashboard ──────────────────────────────────────────────────────────
router.get('/dashboard', protectTenantPrincipal, ctrl.getDashboard);

module.exports = router;
