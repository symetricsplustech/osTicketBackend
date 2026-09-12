const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const ctrl = require('../../controllers/core/problem.controller');

const router = express.Router();

router.post('/', requirePermission('itsm.problem.problem.create'), ctrl.create);
router.get('/', requirePermission('itsm.problem.problem.read'), ctrl.list);
router.get('/known-errors', requirePermission('itsm.problem.problem.read'), ctrl.listKnownErrors);

router.get('/:id', requirePermission('itsm.problem.problem.read'), ctrl.getById);
router.put('/:id', requirePermission('itsm.problem.problem.update'), ctrl.update);
router.post('/:id/transition', requirePermission('itsm.problem.problem.update'), ctrl.transition);
router.post('/:id/assign', requirePermission('itsm.problem.assign'), ctrl.assign);
router.post('/:id/comment', requirePermission('itsm.problem.problem.update'), ctrl.addComment);
router.get('/:id/assignment-history', requirePermission('itsm.problem.problem.read'), ctrl.getAssignmentHistory);

router.post('/:id/incident', requirePermission('itsm.problem.problem.update'), ctrl.linkIncident);
router.delete('/:id/incident/:incidentId', requirePermission('itsm.problem.problem.update'), ctrl.unlinkIncident);
router.get('/:id/incident', requirePermission('itsm.problem.problem.read'), ctrl.listIncidents);

router.post('/:id/ci', requirePermission('itsm.problem.problem.update'), ctrl.linkCI);
router.delete('/:id/ci/:ciId', requirePermission('itsm.problem.problem.update'), ctrl.unlinkCI);
router.get('/:id/ci', requirePermission('itsm.problem.problem.read'), ctrl.listCIs);

router.post('/:id/service-offering', requirePermission('itsm.problem.problem.update'), ctrl.linkServiceOffering);
router.post('/:id/change', requirePermission('itsm.problem.problem.update'), ctrl.linkChange);
router.get('/:id/change', requirePermission('itsm.problem.problem.read'), ctrl.listChanges);
router.post('/:id/knowledge', requirePermission('itsm.problem.problem.update'), ctrl.linkKnowledge);

router.post('/:id/task', requirePermission('itsm.problem.problem.update'), ctrl.createTask);
router.get('/:id/task', requirePermission('itsm.problem.problem.read'), ctrl.listTasks);

router.post('/:id/publish-workaround', requirePermission('itsm.problem.problem.update'), ctrl.publishWorkaround);
router.post('/:id/accept-risk', requirePermission('itsm.problem.problem.update'), ctrl.acceptRisk);
router.post('/:id/reanalyze', requirePermission('itsm.problem.problem.update'), ctrl.reanalyze);

router.post('/:id/known-error', requirePermission('itsm.problem.problem.update'), ctrl.createKnownError);
router.post('/:id/root-cause', requirePermission('itsm.problem.problem.update'), ctrl.createRootCauseRecord);
router.get('/:id/root-cause', requirePermission('itsm.problem.problem.read'), ctrl.listRootCauseRecords);

module.exports = router;
