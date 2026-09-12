const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const ctrl = require('../../controllers/core/change.controller');

const router = express.Router();

router.post('/', requirePermission('itsm.change.change_request.create'), ctrl.create);
router.get('/', requirePermission('itsm.change.change_request.read'), ctrl.list);
router.get('/models', requirePermission('itsm.change.change_request.read'), ctrl.listModels);
router.get('/templates', requirePermission('itsm.change.change_request.read'), ctrl.listTemplates);
router.get('/maintenance-windows', requirePermission('itsm.change.change_request.read'), ctrl.listMaintenanceWindows);
router.get('/blackout-windows', requirePermission('itsm.change.change_request.read'), ctrl.listBlackoutWindows);
router.get('/approval-policies', requirePermission('itsm.change.change_request.read'), ctrl.listApprovalPolicies);
router.get('/cab', requirePermission('itsm.change.change_request.read'), ctrl.listCABs);
router.get('/cab/meetings', requirePermission('itsm.change.change_request.read'), ctrl.listCABMeetings);

router.get('/:id', requirePermission('itsm.change.change_request.read'), ctrl.getById);
router.put('/:id', requirePermission('itsm.change.change_request.update'), ctrl.update);
router.post('/:id/transition', requirePermission('itsm.change.change_request.update'), ctrl.transition);
router.post('/:id/close', requirePermission('itsm.change.change_request.update'), ctrl.close);
router.post('/:id/rollback', requirePermission('itsm.change.change_request.update'), ctrl.rollback);

router.post('/:id/ci', requirePermission('itsm.change.change_request.update'), ctrl.linkCI);
router.delete('/:id/ci/:ciId', requirePermission('itsm.change.change_request.update'), ctrl.unlinkCI);
router.get('/:id/ci', requirePermission('itsm.change.change_request.read'), ctrl.listCIs);
router.post('/:id/service', requirePermission('itsm.change.change_request.update'), ctrl.linkService);

router.post('/:id/risk', requirePermission('itsm.change.change_request.update'), ctrl.assessRisk);
router.post('/:id/conflicts/detect', requirePermission('itsm.change.change_request.read'), ctrl.detectConflicts);
router.get('/:id/conflicts', requirePermission('itsm.change.change_request.read'), ctrl.listConflicts);

router.post('/:id/task', requirePermission('itsm.change.change_request.update'), ctrl.createTask);
router.get('/:id/task', requirePermission('itsm.change.change_request.read'), ctrl.listTasks);
router.post('/:id/result', requirePermission('itsm.change.change_request.update'), ctrl.createImplementationResult);

router.post('/cab/:cabId/meeting', requirePermission('itsm.change.change_request.update'), ctrl.createCABMeeting);
router.post('/cab/meetings/:meetingId/agenda', requirePermission('itsm.change.change_request.update'), ctrl.addAgendaItem);
router.get('/cab/meetings/:meetingId/agenda', requirePermission('itsm.change.change_request.read'), ctrl.listAgendaItems);
router.put('/cab/meetings/agenda/:itemId/decide', requirePermission('itsm.change.change_request.update'), ctrl.decideAgendaItem);
router.post('/cab/meetings/:meetingId/attendee', requirePermission('itsm.change.change_request.update'), ctrl.addAttendee);
router.get('/cab/meetings/:meetingId/attendee', requirePermission('itsm.change.change_request.read'), ctrl.listAttendees);

module.exports = router;
