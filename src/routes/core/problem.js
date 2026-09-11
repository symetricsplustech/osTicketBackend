const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const ctrl = require('../../controllers/core/problem.controller');

const router = express.Router();

router.post('/', requirePermission('problem.create'), ctrl.create);
router.get('/', requirePermission('problem.view'), ctrl.list);
router.get('/known-errors', requirePermission('problem.view'), ctrl.listKnownErrors);

router.get('/:id', requirePermission('problem.view'), ctrl.getById);
router.put('/:id', requirePermission('problem.update'), ctrl.update);
router.post('/:id/transition', requirePermission('problem.update'), ctrl.transition);
router.post('/:id/assign', requirePermission('problem.assign'), ctrl.assign);
router.post('/:id/comment', requirePermission('problem.update'), ctrl.addComment);
router.get('/:id/assignment-history', requirePermission('problem.view'), ctrl.getAssignmentHistory);

router.post('/:id/incident', requirePermission('problem.update'), ctrl.linkIncident);
router.delete('/:id/incident/:incidentId', requirePermission('problem.update'), ctrl.unlinkIncident);
router.get('/:id/incident', requirePermission('problem.view'), ctrl.listIncidents);

router.post('/:id/ci', requirePermission('problem.update'), ctrl.linkCI);
router.delete('/:id/ci/:ciId', requirePermission('problem.update'), ctrl.unlinkCI);
router.get('/:id/ci', requirePermission('problem.view'), ctrl.listCIs);

router.post('/:id/service-offering', requirePermission('problem.update'), ctrl.linkServiceOffering);
router.post('/:id/change', requirePermission('problem.update'), ctrl.linkChange);
router.get('/:id/change', requirePermission('problem.view'), ctrl.listChanges);
router.post('/:id/knowledge', requirePermission('problem.update'), ctrl.linkKnowledge);

router.post('/:id/task', requirePermission('problem.update'), ctrl.createTask);
router.get('/:id/task', requirePermission('problem.view'), ctrl.listTasks);

router.post('/:id/publish-workaround', requirePermission('problem.update'), ctrl.publishWorkaround);
router.post('/:id/accept-risk', requirePermission('problem.update'), ctrl.acceptRisk);
router.post('/:id/reanalyze', requirePermission('problem.update'), ctrl.reanalyze);

router.post('/:id/known-error', requirePermission('problem.update'), ctrl.createKnownError);
router.post('/:id/root-cause', requirePermission('problem.update'), ctrl.createRootCauseRecord);
router.get('/:id/root-cause', requirePermission('problem.view'), ctrl.listRootCauseRecords);

module.exports = router;
