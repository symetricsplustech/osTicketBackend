const router = require('express').Router();
const ctrl = require('../../controllers/core/release.controller');
const { protectTenantPrincipal, requirePermission } = require('../../middleware/auth');

// ─── Releases ──────────────────────────────────────────────────────────
router.get('/releases', protectTenantPrincipal, requirePermission("itsm.release.release.read"), ctrl.listReleases);
router.get('/releases/:id', protectTenantPrincipal, requirePermission("itsm.release.release.read"), ctrl.getRelease);
router.post('/releases', protectTenantPrincipal, requirePermission("itsm.release.release.create"), ctrl.createRelease);
router.put('/releases/:id', protectTenantPrincipal, requirePermission("itsm.release.release.update"), ctrl.updateRelease);
router.delete('/releases/:id', protectTenantPrincipal, requirePermission("itsm.release.release.delete"), ctrl.deleteRelease);
router.post('/releases/:id/transition', protectTenantPrincipal, requirePermission("itsm.release.release.update"), ctrl.transitionRelease);

// ─── Phases ────────────────────────────────────────────────────────────
router.get('/releases/:releaseId/phases', protectTenantPrincipal, requirePermission("itsm.release.release_phase.read"), ctrl.listPhases);
router.get('/phases/:id', protectTenantPrincipal, requirePermission("itsm.release.release_phase.read"), ctrl.getPhase);
router.post('/releases/:releaseId/phases', protectTenantPrincipal, requirePermission("itsm.release.release_phase.create"), ctrl.createPhase);
router.put('/phases/:id', protectTenantPrincipal, requirePermission("itsm.release.release_phase.update"), ctrl.updatePhase);
router.delete('/phases/:id', protectTenantPrincipal, requirePermission("itsm.release.release_phase.delete"), ctrl.deletePhase);

// ─── Tasks ─────────────────────────────────────────────────────────────
router.get('/tasks', protectTenantPrincipal, requirePermission("itsm.release.release_task.read"), ctrl.listTasks);
router.get('/tasks/:id', protectTenantPrincipal, requirePermission("itsm.release.release_task.read"), ctrl.getTask);
router.post('/tasks', protectTenantPrincipal, requirePermission("itsm.release.release_task.create"), ctrl.createTask);
router.put('/tasks/:id', protectTenantPrincipal, requirePermission("itsm.release.release_task.update"), ctrl.updateTask);
router.delete('/tasks/:id', protectTenantPrincipal, requirePermission("itsm.release.release_task.delete"), ctrl.deleteTask);
router.post('/tasks/:id/execute', protectTenantPrincipal, requirePermission("itsm.release.release_task.update"), ctrl.executeTask);

// ─── Components ────────────────────────────────────────────────────────
router.get('/releases/:releaseId/components', protectTenantPrincipal, requirePermission("itsm.release.release_component.read"), ctrl.listComponents);
router.get('/components/:id', protectTenantPrincipal, requirePermission("itsm.release.release_component.read"), ctrl.getComponent);
router.post('/releases/:releaseId/components', protectTenantPrincipal, requirePermission("itsm.release.release_component.create"), ctrl.createComponent);
router.put('/components/:id', protectTenantPrincipal, requirePermission("itsm.release.release_component.update"), ctrl.updateComponent);
router.delete('/components/:id', protectTenantPrincipal, requirePermission("itsm.release.release_component.delete"), ctrl.deleteComponent);

// ─── Dependencies ──────────────────────────────────────────────────────
router.get('/releases/:releaseId/dependencies', protectTenantPrincipal, requirePermission("itsm.release.release_dependency.read"), ctrl.listDependencies);
router.get('/dependencies/:id', protectTenantPrincipal, requirePermission("itsm.release.release_dependency.read"), ctrl.getDependency);
router.post('/releases/:releaseId/dependencies', protectTenantPrincipal, requirePermission("itsm.release.release_dependency.create"), ctrl.createDependency);
router.put('/dependencies/:id', protectTenantPrincipal, requirePermission("itsm.release.release_dependency.update"), ctrl.updateDependency);
router.delete('/dependencies/:id', protectTenantPrincipal, requirePermission("itsm.release.release_dependency.delete"), ctrl.deleteDependency);

// ─── Approvals ─────────────────────────────────────────────────────────
router.get('/releases/:releaseId/approvals', protectTenantPrincipal, requirePermission("itsm.release.release_approval.read"), ctrl.listApprovals);
router.get('/approvals/:id', protectTenantPrincipal, requirePermission("itsm.release.release_approval.read"), ctrl.getApproval);
router.post('/releases/:releaseId/approvals', protectTenantPrincipal, requirePermission("itsm.release.release_approval.create"), ctrl.createApproval);
router.post('/approvals/:id/decide', protectTenantPrincipal, requirePermission("itsm.release.release_approval.update"), ctrl.decideApproval);
router.delete('/approvals/:id', protectTenantPrincipal, requirePermission("itsm.release.release_approval.delete"), ctrl.deleteApproval);

// ─── Deployments ───────────────────────────────────────────────────────
router.get('/releases/:releaseId/deployments', protectTenantPrincipal, requirePermission("itsm.release.release_deployment.read"), ctrl.listDeployments);
router.get('/deployments/:id', protectTenantPrincipal, requirePermission("itsm.release.release_deployment.read"), ctrl.getDeployment);
router.post('/releases/:releaseId/deployments', protectTenantPrincipal, requirePermission("itsm.release.release_deployment.create"), ctrl.createDeployment);
router.put('/deployments/:id', protectTenantPrincipal, requirePermission("itsm.release.release_deployment.update"), ctrl.updateDeployment);
router.delete('/deployments/:id', protectTenantPrincipal, requirePermission("itsm.release.release_deployment.delete"), ctrl.deleteDeployment);
router.post('/deployments/:id/start', protectTenantPrincipal, requirePermission("itsm.release.release_deployment.update"), ctrl.startDeployment);
router.post('/deployments/:id/complete', protectTenantPrincipal, requirePermission("itsm.release.release_deployment.update"), ctrl.completeDeployment);
router.post('/deployments/:id/rollback', protectTenantPrincipal, requirePermission("itsm.release.release_deployment.update"), ctrl.rollbackDeployment);

// ─── Change Association ────────────────────────────────────────────────
router.post('/releases/:releaseId/changes', protectTenantPrincipal, requirePermission("itsm.release.release.update"), ctrl.associateChange);
router.delete('/releases/:releaseId/changes/:changeId', protectTenantPrincipal, requirePermission("itsm.release.release.update"), ctrl.removeChange);

// ─── Dashboard ──────────────────────────────────────────────────────────
router.get('/dashboard', protectTenantPrincipal, requirePermission("itsm.release.release.read"), ctrl.getDashboard);

module.exports = router;
