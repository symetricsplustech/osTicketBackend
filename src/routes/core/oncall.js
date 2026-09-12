const router = require('express').Router();
const ctrl = require('../../controllers/core/oncall.controller');
const { protectTenantPrincipal } = require('../../middleware/auth');

// ─── Schedules ──────────────────────────────────────────────────────────
router.get('/schedules', protectTenantPrincipal, ctrl.listSchedules);
router.get('/schedules/:id', protectTenantPrincipal, ctrl.getSchedule);
router.post('/schedules', protectTenantPrincipal, ctrl.createSchedule);
router.put('/schedules/:id', protectTenantPrincipal, ctrl.updateSchedule);
router.delete('/schedules/:id', protectTenantPrincipal, ctrl.deleteSchedule);
router.post('/schedules/:id/publish', protectTenantPrincipal, ctrl.publishSchedule);

// ─── Shifts ─────────────────────────────────────────────────────────────
router.get('/shifts', protectTenantPrincipal, ctrl.listShifts);
router.get('/shifts/:id', protectTenantPrincipal, ctrl.getShift);
router.post('/shifts', protectTenantPrincipal, ctrl.createShift);
router.put('/shifts/:id', protectTenantPrincipal, ctrl.updateShift);
router.delete('/shifts/:id', protectTenantPrincipal, ctrl.deleteShift);
router.post('/shifts/:id/handover', protectTenantPrincipal, ctrl.completeHandover);

// ─── Rosters ────────────────────────────────────────────────────────────
router.get('/rosters', protectTenantPrincipal, ctrl.listRosters);
router.get('/rosters/:id', protectTenantPrincipal, ctrl.getRoster);
router.post('/rosters', protectTenantPrincipal, ctrl.createRoster);
router.put('/rosters/:id', protectTenantPrincipal, ctrl.updateRoster);
router.delete('/rosters/:id', protectTenantPrincipal, ctrl.deleteRoster);

// ─── Roster Members ────────────────────────────────────────────────────
router.get('/rosters/:rosterId/members', protectTenantPrincipal, ctrl.listRosterMembers);
router.post('/rosters/:rosterId/members', protectTenantPrincipal, ctrl.addRosterMember);
router.delete('/rosters/:rosterId/members/:userId', protectTenantPrincipal, ctrl.removeRosterMember);

// ─── Rotations ──────────────────────────────────────────────────────────
router.get('/rotations', protectTenantPrincipal, ctrl.listRotations);
router.get('/rotations/:id', protectTenantPrincipal, ctrl.getRotation);
router.post('/rotations', protectTenantPrincipal, ctrl.createRotation);
router.put('/rotations/:id', protectTenantPrincipal, ctrl.updateRotation);
router.delete('/rotations/:id', protectTenantPrincipal, ctrl.deleteRotation);
router.post('/rotations/:id/advance', protectTenantPrincipal, ctrl.advanceRotation);

// ─── Coverage Requests ─────────────────────────────────────────────────
router.get('/coverage', protectTenantPrincipal, ctrl.listCoverageRequests);
router.get('/coverage/:id', protectTenantPrincipal, ctrl.getCoverageRequest);
router.post('/coverage', protectTenantPrincipal, ctrl.createCoverageRequest);
router.post('/coverage/:id/approve', protectTenantPrincipal, ctrl.approveCoverageRequest);
router.post('/coverage/:id/reject', protectTenantPrincipal, ctrl.rejectCoverageRequest);

// ─── Time-Off Requests ─────────────────────────────────────────────────
router.get('/timeoff', protectTenantPrincipal, ctrl.listTimeOffRequests);
router.get('/timeoff/:id', protectTenantPrincipal, ctrl.getTimeOffRequest);
router.post('/timeoff', protectTenantPrincipal, ctrl.createTimeOffRequest);
router.post('/timeoff/:id/approve', protectTenantPrincipal, ctrl.approveTimeOffRequest);
router.post('/timeoff/:id/reject', protectTenantPrincipal, ctrl.rejectTimeOffRequest);

// ─── Escalation Policies ────────────────────────────────────────────────
router.get('/escalation-policies', protectTenantPrincipal, ctrl.listEscalationPolicies);
router.get('/escalation-policies/:id', protectTenantPrincipal, ctrl.getEscalationPolicy);
router.post('/escalation-policies', protectTenantPrincipal, ctrl.createEscalationPolicy);
router.put('/escalation-policies/:id', protectTenantPrincipal, ctrl.updateEscalationPolicy);
router.delete('/escalation-policies/:id', protectTenantPrincipal, ctrl.deleteEscalationPolicy);

// ─── Escalation Levels ──────────────────────────────────────────────────
router.get('/escalation-policies/:policyId/levels', protectTenantPrincipal, ctrl.listEscalationLevels);
router.post('/escalation-policies/:policyId/levels', protectTenantPrincipal, ctrl.createEscalationLevel);
router.put('/escalation-levels/:id', protectTenantPrincipal, ctrl.updateEscalationLevel);
router.delete('/escalation-levels/:id', protectTenantPrincipal, ctrl.deleteEscalationLevel);

// ─── Contact Preferences ────────────────────────────────────────────────
router.get('/contact-preferences/:userId', protectTenantPrincipal, ctrl.getContactPreference);
router.put('/contact-preferences/:userId', protectTenantPrincipal, ctrl.updateContactPreference);

// ─── Current On-Call ────────────────────────────────────────────────────
router.get('/current/:scheduleId', protectTenantPrincipal, ctrl.getCurrentOnCall);
router.get('/upcoming/:scheduleId', protectTenantPrincipal, ctrl.getUpcomingShifts);
router.get('/agent/team/:teamId', protectTenantPrincipal, ctrl.getOnCallAgentForTeam);

// ─── Gap Detection ──────────────────────────────────────────────────────
router.get('/gaps/:scheduleId', protectTenantPrincipal, ctrl.detectGaps);

// ─── Dashboard ──────────────────────────────────────────────────────────
router.get('/dashboard', protectTenantPrincipal, ctrl.getDashboard);

// ─── Job Trigger ────────────────────────────────────────────────────────
router.post('/notify-upcoming', protectTenantPrincipal, ctrl.notifyUpcomingShifts);

module.exports = router;
