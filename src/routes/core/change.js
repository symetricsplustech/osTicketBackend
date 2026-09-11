const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const ctrl = require('../../controllers/core/change.controller');

const router = express.Router();

router.post('/', requirePermission('change.create'), ctrl.create);
router.get('/', requirePermission('change.view'), ctrl.list);
router.get('/models', requirePermission('change.view'), ctrl.listModels);
router.get('/templates', requirePermission('change.view'), ctrl.listTemplates);
router.get('/maintenance-windows', requirePermission('change.view'), ctrl.listMaintenanceWindows);
router.get('/blackout-windows', requirePermission('change.view'), ctrl.listBlackoutWindows);
router.get('/approval-policies', requirePermission('change.view'), ctrl.listApprovalPolicies);
router.get('/cab', requirePermission('change.view'), ctrl.listCABs);
router.get('/cab/meetings', requirePermission('change.view'), ctrl.listCABMeetings);

router.get('/:id', requirePermission('change.view'), ctrl.getById);
router.put('/:id', requirePermission('change.update'), ctrl.update);
router.post('/:id/transition', requirePermission('change.update'), ctrl.transition);
router.post('/:id/close', requirePermission('change.update'), ctrl.close);
router.post('/:id/rollback', requirePermission('change.update'), ctrl.rollback);

router.post('/:id/ci', requirePermission('change.update'), ctrl.linkCI);
router.delete('/:id/ci/:ciId', requirePermission('change.update'), ctrl.unlinkCI);
router.get('/:id/ci', requirePermission('change.view'), ctrl.listCIs);
router.post('/:id/service', requirePermission('change.update'), ctrl.linkService);

router.post('/:id/risk', requirePermission('change.update'), ctrl.assessRisk);
router.post('/:id/conflicts/detect', requirePermission('change.view'), ctrl.detectConflicts);
router.get('/:id/conflicts', requirePermission('change.view'), ctrl.listConflicts);

router.post('/:id/task', requirePermission('change.update'), ctrl.createTask);
router.get('/:id/task', requirePermission('change.view'), ctrl.listTasks);
router.post('/:id/result', requirePermission('change.update'), ctrl.createImplementationResult);

router.post('/cab/:cabId/meeting', requirePermission('change.update'), ctrl.createCABMeeting);
router.post('/cab/meetings/:meetingId/agenda', requirePermission('change.update'), ctrl.addAgendaItem);
router.get('/cab/meetings/:meetingId/agenda', requirePermission('change.view'), ctrl.listAgendaItems);
router.put('/cab/meetings/agenda/:itemId/decide', requirePermission('change.update'), ctrl.decideAgendaItem);
router.post('/cab/meetings/:meetingId/attendee', requirePermission('change.update'), ctrl.addAttendee);
router.get('/cab/meetings/:meetingId/attendee', requirePermission('change.view'), ctrl.listAttendees);

module.exports = router;
