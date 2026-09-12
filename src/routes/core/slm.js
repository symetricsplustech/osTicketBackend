/**
 * Service Level Management API routes — SLA plans, OLA, UC targets, schedules,
 * calendars, conditions, events, breakdowns, repair jobs, dashboard.
 * Base: /core/slm/*
 */
const router = require("express").Router();
const ctrl = require("../../controllers/core/slm.controller");
const {
  protectTenantPrincipal,
  requirePermission,
} = require("../../middleware/auth");

// ─── SLA Plans ──────────────────────────────────────────────────────────
router.get(
  "/plans",
  protectTenantPrincipal,
  requirePermission("itsm.sla.sladefinition.read"),
  ctrl.listPlans,
);
router.get(
  "/plans/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.sladefinition.read"),
  ctrl.getPlan,
);
router.post(
  "/plans",
  protectTenantPrincipal,
  requirePermission("itsm.sla.sladefinition.create"),
  ctrl.createPlan,
);
router.put(
  "/plans/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.sladefinition.update"),
  ctrl.updatePlan,
);
router.delete(
  "/plans/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.sladefinition.delete"),
  ctrl.deletePlan,
);
router.post(
  "/plans/:id/clone",
  protectTenantPrincipal,
  requirePermission("itsm.sla.definition_create"),
  ctrl.clonePlan,
);

// ─── OLA ────────────────────────────────────────────────────────────────
router.get(
  "/olas",
  protectTenantPrincipal,
  requirePermission("itsm.sla.ola.read"),
  ctrl.listOLAs,
);
router.get(
  "/olas/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.ola.read"),
  ctrl.getOLA,
);
router.post(
  "/olas",
  protectTenantPrincipal,
  requirePermission("itsm.sla.ola.create"),
  ctrl.createOLA,
);
router.put(
  "/olas/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.ola.update"),
  ctrl.updateOLA,
);
router.delete(
  "/olas/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.ola.delete"),
  ctrl.deleteOLA,
);

// ─── Underpinning Contract Targets ──────────────────────────────────────
router.get(
  "/uc-targets",
  protectTenantPrincipal,
  requirePermission("itsm.sla.underpinning_contract_target.read"),
  ctrl.listUCTargets,
);
router.post(
  "/uc-targets",
  protectTenantPrincipal,
  requirePermission("itsm.sla.underpinning_contract_target.create"),
  ctrl.createUCTarget,
);
router.put(
  "/uc-targets/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.underpinning_contract_target.update"),
  ctrl.updateUCTarget,
);
router.delete(
  "/uc-targets/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.underpinning_contract_target.delete"),
  ctrl.deleteUCTarget,
);
router.post(
  "/uc-targets/:id/measure",
  protectTenantPrincipal,
  requirePermission("itsm.sla.uc_target_manage"),
  ctrl.measureUCTarget,
);

// ─── Schedules ──────────────────────────────────────────────────────────
router.get(
  "/schedules",
  protectTenantPrincipal,
  requirePermission("itsm.sla.business_schedule.read"),
  ctrl.listSchedules,
);
router.get(
  "/schedules/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.business_schedule.read"),
  ctrl.getSchedule,
);
router.post(
  "/schedules",
  protectTenantPrincipal,
  requirePermission("itsm.sla.business_schedule.create"),
  ctrl.createSchedule,
);
router.put(
  "/schedules/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.business_schedule.update"),
  ctrl.updateSchedule,
);
router.delete(
  "/schedules/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.business_schedule.delete"),
  ctrl.deleteSchedule,
);

// ─── Holiday Calendars ──────────────────────────────────────────────────
router.get(
  "/calendars",
  protectTenantPrincipal,
  requirePermission("itsm.sla.holiday_calendar.read"),
  ctrl.listCalendars,
);
router.post(
  "/calendars",
  protectTenantPrincipal,
  requirePermission("itsm.sla.holiday_calendar.create"),
  ctrl.createCalendar,
);
router.put(
  "/calendars/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.holiday_calendar.update"),
  ctrl.updateCalendar,
);
router.delete(
  "/calendars/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.holiday_calendar.delete"),
  ctrl.deleteCalendar,
);

// ─── Conditions ─────────────────────────────────────────────────────────
router.get(
  "/plans/:slaPlanId/conditions",
  protectTenantPrincipal,
  requirePermission("itsm.sla.sladefinition.read"),
  ctrl.listConditions,
);
router.post(
  "/plans/:slaPlanId/conditions",
  protectTenantPrincipal,
  requirePermission("itsm.sla.sladefinition.create"),
  ctrl.createCondition,
);
router.put(
  "/conditions/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.slacondition.update"),
  ctrl.updateCondition,
);
router.delete(
  "/conditions/:id",
  protectTenantPrincipal,
  requirePermission("itsm.sla.slacondition.delete"),
  ctrl.deleteCondition,
);

// ─── Events / Timeline ──────────────────────────────────────────────────
router.get(
  "/events",
  protectTenantPrincipal,
  requirePermission("itsm.sla.slaevent.read"),
  ctrl.getSLAEvents,
);
router.get(
  "/timeline/:ticketId",
  protectTenantPrincipal,
  requirePermission("itsm.sla.task_sla.read"),
  ctrl.getTicketSLATimeline,
);

// ─── Breakdowns ─────────────────────────────────────────────────────────
router.get(
  "/breakdowns/:ticketId",
  protectTenantPrincipal,
  requirePermission("itsm.sla.slabreakdown.read"),
  ctrl.getBreakdowns,
);

// ─── Repair Jobs ────────────────────────────────────────────────────────
router.get(
  "/repair-jobs",
  protectTenantPrincipal,
  requirePermission("itsm.sla.slarepair_job.read"),
  ctrl.listRepairJobs,
);
router.post(
  "/repair-jobs",
  protectTenantPrincipal,
  requirePermission("itsm.sla.slarepair_job.create"),
  ctrl.createRepairJob,
);
router.post(
  "/repair-jobs/:id/start",
  protectTenantPrincipal,
  requirePermission("itsm.sla.task_sla_repair"),
  ctrl.startRepairJob,
);
router.post(
  "/repair-jobs/:id/complete",
  protectTenantPrincipal,
  requirePermission("itsm.sla.task_sla_repair"),
  ctrl.completeRepairJob,
);

// ─── Dashboard & Recalculate ────────────────────────────────────────────
router.get(
  "/dashboard",
  protectTenantPrincipal,
  requirePermission("itsm.sla.sladefinition.read"),
  ctrl.getDashboard,
);
router.post(
  "/recalculate",
  protectTenantPrincipal,
  requirePermission("itsm.sla.task_sla_recalculate"),
  ctrl.recalculateDueDates,
);

module.exports = router;
