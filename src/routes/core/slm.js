/**
 * Service Level Management API routes — SLA plans, OLA, UC targets, schedules,
 * calendars, conditions, events, breakdowns, repair jobs, dashboard.
 * Base: /core/slm/*
 */
const router = require('express').Router();
const ctrl = require('../../controllers/core/slm.controller');
const { protectTenantPrincipal } = require('../../middleware/auth');

// ─── SLA Plans ──────────────────────────────────────────────────────────
router.get('/plans', protectTenantPrincipal, ctrl.listPlans);
router.get('/plans/:id', protectTenantPrincipal, ctrl.getPlan);
router.post('/plans', protectTenantPrincipal, ctrl.createPlan);
router.put('/plans/:id', protectTenantPrincipal, ctrl.updatePlan);
router.delete('/plans/:id', protectTenantPrincipal, ctrl.deletePlan);
router.post('/plans/:id/clone', protectTenantPrincipal, ctrl.clonePlan);

// ─── OLA ────────────────────────────────────────────────────────────────
router.get('/olas', protectTenantPrincipal, ctrl.listOLAs);
router.get('/olas/:id', protectTenantPrincipal, ctrl.getOLA);
router.post('/olas', protectTenantPrincipal, ctrl.createOLA);
router.put('/olas/:id', protectTenantPrincipal, ctrl.updateOLA);
router.delete('/olas/:id', protectTenantPrincipal, ctrl.deleteOLA);

// ─── Underpinning Contract Targets ──────────────────────────────────────
router.get('/uc-targets', protectTenantPrincipal, ctrl.listUCTargets);
router.post('/uc-targets', protectTenantPrincipal, ctrl.createUCTarget);
router.put('/uc-targets/:id', protectTenantPrincipal, ctrl.updateUCTarget);
router.delete('/uc-targets/:id', protectTenantPrincipal, ctrl.deleteUCTarget);
router.post('/uc-targets/:id/measure', protectTenantPrincipal, ctrl.measureUCTarget);

// ─── Schedules ──────────────────────────────────────────────────────────
router.get('/schedules', protectTenantPrincipal, ctrl.listSchedules);
router.get('/schedules/:id', protectTenantPrincipal, ctrl.getSchedule);
router.post('/schedules', protectTenantPrincipal, ctrl.createSchedule);
router.put('/schedules/:id', protectTenantPrincipal, ctrl.updateSchedule);
router.delete('/schedules/:id', protectTenantPrincipal, ctrl.deleteSchedule);

// ─── Holiday Calendars ──────────────────────────────────────────────────
router.get('/calendars', protectTenantPrincipal, ctrl.listCalendars);
router.post('/calendars', protectTenantPrincipal, ctrl.createCalendar);
router.put('/calendars/:id', protectTenantPrincipal, ctrl.updateCalendar);
router.delete('/calendars/:id', protectTenantPrincipal, ctrl.deleteCalendar);

// ─── Conditions ─────────────────────────────────────────────────────────
router.get('/plans/:slaPlanId/conditions', protectTenantPrincipal, ctrl.listConditions);
router.post('/plans/:slaPlanId/conditions', protectTenantPrincipal, ctrl.createCondition);
router.put('/conditions/:id', protectTenantPrincipal, ctrl.updateCondition);
router.delete('/conditions/:id', protectTenantPrincipal, ctrl.deleteCondition);

// ─── Events / Timeline ──────────────────────────────────────────────────
router.get('/events', protectTenantPrincipal, ctrl.getSLAEvents);
router.get('/timeline/:ticketId', protectTenantPrincipal, ctrl.getTicketSLATimeline);

// ─── Breakdowns ─────────────────────────────────────────────────────────
router.get('/breakdowns/:ticketId', protectTenantPrincipal, ctrl.getBreakdowns);

// ─── Repair Jobs ────────────────────────────────────────────────────────
router.get('/repair-jobs', protectTenantPrincipal, ctrl.listRepairJobs);
router.post('/repair-jobs', protectTenantPrincipal, ctrl.createRepairJob);
router.post('/repair-jobs/:id/start', protectTenantPrincipal, ctrl.startRepairJob);
router.post('/repair-jobs/:id/complete', protectTenantPrincipal, ctrl.completeRepairJob);

// ─── Dashboard & Recalculate ────────────────────────────────────────────
router.get('/dashboard', protectTenantPrincipal, ctrl.getDashboard);
router.post('/recalculate', protectTenantPrincipal, ctrl.recalculateDueDates);

module.exports = router;
