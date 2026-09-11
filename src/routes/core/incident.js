const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const ctrl = require('../../controllers/core/incident.controller');

const router = express.Router();

router.post('/', requirePermission('incident.create'), ctrl.create);
router.get('/', requirePermission('incident.view'), ctrl.list);
router.get('/duplicates', requirePermission('incident.view'), ctrl.getDuplicateCandidates);
router.get('/major', requirePermission('incident.view'), ctrl.listMajorIncidents);
router.get('/major/candidates', requirePermission('incident.view'), ctrl.listMajorCandidates);
router.get('/pir', requirePermission('incident.view'), ctrl.listPIRs);

router.get('/:id', requirePermission('incident.view'), ctrl.getById);
router.put('/:id', requirePermission('incident.update'), ctrl.update);
router.post('/:id/transition', requirePermission('incident.update'), ctrl.transition);
router.post('/:id/assign', requirePermission('incident.assign'), ctrl.assign);
router.post('/:id/comment', requirePermission('incident.update'), ctrl.addComment);
router.post('/:id/resolve', requirePermission('incident.resolve'), ctrl.resolve);
router.post('/:id/close', requirePermission('incident.close'), ctrl.close);
router.post('/:id/reopen', requirePermission('incident.reopen'), ctrl.reopen);
router.post('/:id/cancel', requirePermission('incident.cancel'), ctrl.cancel);
router.get('/:id/assignment-history', requirePermission('incident.view'), ctrl.getAssignmentHistory);

router.post('/:id/ci', requirePermission('incident.update'), ctrl.linkCI);
router.delete('/:id/ci/:ciId', requirePermission('incident.update'), ctrl.unlinkCI);
router.get('/:id/ci', requirePermission('incident.view'), ctrl.listCIs);
router.post('/:id/service-offering', requirePermission('incident.update'), ctrl.linkServiceOffering);
router.post('/:id/relationship', requirePermission('incident.update'), ctrl.linkIncident);
router.get('/:id/relationship', requirePermission('incident.view'), ctrl.listRelationships);

router.post('/:id/task', requirePermission('incident.update'), ctrl.createTask);
router.get('/:id/task', requirePermission('incident.view'), ctrl.listTasks);

router.post('/:id/major/nominate', requirePermission('incident.update'), ctrl.nominateMajor);
router.post('/:id/major/approve', requirePermission('incident.update'), ctrl.approveMajor);
router.post('/:id/major/reject', requirePermission('incident.update'), ctrl.rejectMajor);
router.get('/:id/major', requirePermission('incident.view'), ctrl.getMajorIncident);
router.post('/:id/major/demote', requirePermission('incident.update'), ctrl.demoteMajor);
router.put('/:id/major/comm-plan', requirePermission('incident.update'), ctrl.updateMajorCommPlan);
router.put('/:id/major/exec-summary', requirePermission('incident.update'), ctrl.updateMajorExecSummary);

router.post('/:id/major/participant', requirePermission('incident.update'), ctrl.addMajorParticipant);
router.delete('/:id/major/participant/:userId', requirePermission('incident.update'), ctrl.removeMajorParticipant);
router.get('/:id/major/participant', requirePermission('incident.view'), ctrl.listMajorParticipants);
router.post('/:id/major/timeline', requirePermission('incident.update'), ctrl.addMajorTimelineEvent);
router.get('/:id/major/timeline', requirePermission('incident.view'), ctrl.listMajorTimelineEvents);

router.post('/:id/pir', requirePermission('incident.update'), ctrl.createPIR);
router.get('/:id/pir/:pirId', requirePermission('incident.view'), ctrl.getPIR);
router.put('/:id/pir/:pirId', requirePermission('incident.update'), ctrl.updatePIR);
router.post('/:id/pir/:pirId/submit', requirePermission('incident.update'), ctrl.submitPIRForReview);
router.post('/:id/pir/:pirId/approve', requirePermission('incident.update'), ctrl.approvePIR);
router.post('/:id/pir/:pirId/publish', requirePermission('incident.update'), ctrl.publishPIR);
router.post('/:id/pir/:pirId/action-item', requirePermission('incident.update'), ctrl.addPIRActionItem);
router.put('/:id/pir/:pirId/action-item/:actionItemId', requirePermission('incident.update'), ctrl.updatePIRActionItem);
router.delete('/:id/pir/:pirId/action-item/:actionItemId', requirePermission('incident.update'), ctrl.deletePIRActionItem);

module.exports = router;
