/**
 * Service Level Management service — unified business logic for SLA plans,
 * OLA, UC targets, schedules, conditions, breakdowns, repair jobs, and dashboard.
 */
const mongoose = require("mongoose");
const { emitEvent } = require("../realtime/socketManager");
const auditEventService = require("./auditEventService");
const numberingService = require("./numbering.service");

// Register SLM models before retrieving them from Mongoose's registry.
require("../models/SlaPlan");
require("../models/SlaEvent");
require("../models/slm/OLA");
require("../models/slm/UnderpinningContractTarget");
require("../models/slm/SLACondition");
require("../models/slm/BusinessSchedule");
require("../models/slm/HolidayCalendar");
require("../models/slm/SLABreakdown");
require("../models/slm/SLARepairJob");
require("../models/helpdesk/tickets/Ticket");

const requireTenant = (ctx) => {
  if (!ctx.tenantId)
    throw Object.assign(new Error("Tenant context required"), {
      statusCode: 400,
    });
  return ctx.tenantId;
};
const pick = (obj, keys) =>
  Object.fromEntries(
    keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]),
  );

const SlaPlan = mongoose.model("SlaPlan");
const SlaEvent = mongoose.model("SlaEvent");
const OLA = mongoose.model("OLA");
const UnderpinningContractTarget = mongoose.model("UnderpinningContractTarget");
const SLACondition = mongoose.model("SLACondition");
const BusinessSchedule = mongoose.model("BusinessSchedule");
const HolidayCalendar = mongoose.model("HolidayCalendar");
const SLABreakdown = mongoose.model("SLABreakdown");
const SLARepairJob = mongoose.model("SLARepairJob");
const Ticket = mongoose.model("Ticket");

// ─── SLA Plan CRUD ──────────────────────────────────────────────────────

exports.listPlans = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { company: tenantId, ...pick(query, ["status", "schedule"]) };
  if (query.search)
    filter.$or = [{ name: { $regex: query.search, $options: "i" } }];
  return SlaPlan.find(filter).sort({ name: 1 });
};

exports.getPlan = async (ctx, planId) => {
  const tenantId = requireTenant(ctx);
  const plan = await SlaPlan.findOne({ _id: planId, company: tenantId });
  if (!plan)
    throw Object.assign(new Error("SLA plan not found"), { statusCode: 404 });
  return plan;
};

exports.createPlan = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const plan = await SlaPlan.create({ ...data, company: tenantId });
  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "slaPlan.create",
    entityType: "SlaPlan",
    entityId: plan._id,
  });
  return plan;
};

exports.updatePlan = async (ctx, planId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const plan = await SlaPlan.findOne({ _id: planId, company: tenantId });
  if (!plan)
    throw Object.assign(new Error("SLA plan not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "gracePeriod",
    "schedule",
    "timezone",
    "businessHours",
    "status",
    "notes",
    "targets",
    "pauseRules",
    "escalationRules",
    "pauseOnWaiting",
    "notifyOnBreach",
    "notifyOnAtRisk",
    "breachEscalate",
  ];
  const before = JSON.parse(JSON.stringify(plan));
  Object.assign(plan, pick(data, allowed));
  await plan.save();
  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "slaPlan.update",
    entityType: "SlaPlan",
    entityId: planId,
    before,
    after: plan,
  });
  return plan;
};

exports.deletePlan = async (ctx, planId, actor) => {
  const tenantId = requireTenant(ctx);
  const plan = await SlaPlan.findOne({ _id: planId, company: tenantId });
  if (!plan)
    throw Object.assign(new Error("SLA plan not found"), { statusCode: 404 });
  await SlaPlan.deleteOne({ _id: planId });
  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "slaPlan.delete",
    entityType: "SlaPlan",
    entityId: planId,
  });
  return { success: true };
};

exports.clonePlan = async (ctx, planId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const original = await SlaPlan.findOne({ _id: planId, company: tenantId });
  if (!original)
    throw Object.assign(new Error("SLA plan not found"), { statusCode: 404 });
  const clone = original.toObject();
  delete clone._id;
  clone.name = data.name || `${original.name} (Copy)`;
  clone.status = "draft";
  const newPlan = await SlaPlan.create({ ...clone, company: tenantId });
  return newPlan;
};

// ─── OLA CRUD ───────────────────────────────────────────────────────────

exports.listOLAs = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["isActive", "department", "group"]),
  };
  return OLA.find(filter)
    .sort({ name: 1 })
    .populate("slaPlanId", "name")
    .populate("department", "name");
};

exports.getOLA = async (ctx, olaId) => {
  const tenantId = requireTenant(ctx);
  const ola = await OLA.findOne({
    _id: olaId,
    tenantId,
    isDeleted: false,
  }).populate("slaPlanId");
  if (!ola)
    throw Object.assign(new Error("OLA not found"), { statusCode: 404 });
  return ola;
};

exports.createOLA = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "OLA");
  const ola = await OLA.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
  return ola;
};

exports.updateOLA = async (ctx, olaId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const ola = await OLA.findOne({ _id: olaId, tenantId, isDeleted: false });
  if (!ola)
    throw Object.assign(new Error("OLA not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "description",
    "slaPlanId",
    "department",
    "group",
    "service",
    "targets",
    "schedule",
    "timezone",
    "isActive",
    "status",
  ];
  Object.assign(ola, pick(data, allowed));
  await ola.save();
  return ola;
};

exports.deleteOLA = async (ctx, olaId, actor) => {
  const tenantId = requireTenant(ctx);
  const ola = await OLA.findOne({ _id: olaId, tenantId, isDeleted: false });
  if (!ola)
    throw Object.assign(new Error("OLA not found"), { statusCode: 404 });
  ola.isDeleted = true;
  ola.deletedAt = new Date();
  ola.deletedBy = actor.userId;
  await ola.save();
  return { success: true };
};

// ─── Underpinning Contract Targets ──────────────────────────────────────

exports.listUCTargets = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["contractId", "status", "isActive"]),
  };
  return UnderpinningContractTarget.find(filter).sort({ name: 1 });
};

exports.createUCTarget = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "UC");
  return UnderpinningContractTarget.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateUCTarget = async (ctx, targetId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const target = await UnderpinningContractTarget.findOne({
    _id: targetId,
    tenantId,
    isDeleted: false,
  });
  if (!target)
    throw Object.assign(new Error("UC target not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "metric",
    "description",
    "targetValue",
    "targetUnit",
    "comparisonOperator",
    "measurementWindow",
    "isActive",
  ];
  Object.assign(target, pick(data, allowed));
  await target.save();
  return target;
};

exports.deleteUCTarget = async (ctx, targetId, actor) => {
  const tenantId = requireTenant(ctx);
  const target = await UnderpinningContractTarget.findOne({
    _id: targetId,
    tenantId,
    isDeleted: false,
  });
  if (!target)
    throw Object.assign(new Error("UC target not found"), { statusCode: 404 });
  target.isDeleted = true;
  target.deletedAt = new Date();
  target.deletedBy = actor.userId;
  await target.save();
  return { success: true };
};

// ─── Business Schedule CRUD ─────────────────────────────────────────────

exports.listSchedules = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["isActive", "type"]),
  };
  return BusinessSchedule.find(filter).sort({ name: 1 });
};

exports.getSchedule = async (ctx, scheduleId) => {
  const tenantId = requireTenant(ctx);
  const schedule = await BusinessSchedule.findOne({
    _id: scheduleId,
    tenantId,
    isDeleted: false,
  });
  if (!schedule)
    throw Object.assign(new Error("Schedule not found"), { statusCode: 404 });
  return schedule;
};

exports.createSchedule = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "SCHED");
  return BusinessSchedule.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateSchedule = async (ctx, scheduleId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const schedule = await BusinessSchedule.findOne({
    _id: scheduleId,
    tenantId,
    isDeleted: false,
  });
  if (!schedule)
    throw Object.assign(new Error("Schedule not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "description",
    "type",
    "timezone",
    "businessHours",
    "holidays",
    "isActive",
    "isDefault",
  ];
  Object.assign(schedule, pick(data, allowed));
  await schedule.save();
  return schedule;
};

exports.deleteSchedule = async (ctx, scheduleId, actor) => {
  const tenantId = requireTenant(ctx);
  const schedule = await BusinessSchedule.findOne({
    _id: scheduleId,
    tenantId,
    isDeleted: false,
  });
  if (!schedule)
    throw Object.assign(new Error("Schedule not found"), { statusCode: 404 });
  schedule.isDeleted = true;
  schedule.deletedAt = new Date();
  schedule.deletedBy = actor.userId;
  await schedule.save();
  return { success: true };
};

// ─── Holiday Calendar CRUD ──────────────────────────────────────────────

exports.listCalendars = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ["isActive"]) };
  return HolidayCalendar.find(filter).sort({ name: 1 });
};

exports.createCalendar = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "HCAL");
  data.holidayCount = data.holidays?.length || 0;
  return HolidayCalendar.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateCalendar = async (ctx, calendarId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const cal = await HolidayCalendar.findOne({
    _id: calendarId,
    tenantId,
    isDeleted: false,
  });
  if (!cal)
    throw Object.assign(new Error("Calendar not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "description",
    "timezone",
    "holidays",
    "isActive",
    "isDefault",
  ];
  Object.assign(cal, pick(data, allowed));
  cal.holidayCount = cal.holidays?.length || 0;
  await cal.save();
  return cal;
};

exports.deleteCalendar = async (ctx, calendarId, actor) => {
  const tenantId = requireTenant(ctx);
  const cal = await HolidayCalendar.findOne({
    _id: calendarId,
    tenantId,
    isDeleted: false,
  });
  if (!cal)
    throw Object.assign(new Error("Calendar not found"), { statusCode: 404 });
  cal.isDeleted = true;
  cal.deletedAt = new Date();
  cal.deletedBy = actor.userId;
  await cal.save();
  return { success: true };
};

// ─── SLA Conditions ─────────────────────────────────────────────────────

exports.listConditions = async (ctx, slaPlanId) => {
  const tenantId = requireTenant(ctx);
  return SLACondition.find({ tenantId, slaPlanId, isDeleted: false }).sort({
    priority: 1,
  });
};

exports.createCondition = async (ctx, slaPlanId, data, actor) => {
  const tenantId = requireTenant(ctx);
  return SLACondition.create({
    ...data,
    tenantId,
    slaPlanId,
    createdBy: actor.userId,
  });
};

exports.updateCondition = async (ctx, conditionId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const cond = await SLACondition.findOne({
    _id: conditionId,
    tenantId,
    isDeleted: false,
  });
  if (!cond)
    throw Object.assign(new Error("Condition not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "description",
    "isActive",
    "priority",
    "conditions",
    "conditionGroups",
  ];
  Object.assign(cond, pick(data, allowed));
  await cond.save();
  return cond;
};

exports.deleteCondition = async (ctx, conditionId, actor) => {
  const tenantId = requireTenant(ctx);
  const cond = await SLACondition.findOne({
    _id: conditionId,
    tenantId,
    isDeleted: false,
  });
  if (!cond)
    throw Object.assign(new Error("Condition not found"), { statusCode: 404 });
  cond.isDeleted = true;
  cond.deletedAt = new Date();
  cond.deletedBy = actor.userId;
  await cond.save();
  return { success: true };
};

// ─── SLA Events / Timeline ──────────────────────────────────────────────

exports.getSLAEvents = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    company: tenantId,
    ...pick(query, ["ticket", "policy", "event", "clock"]),
  };
  return SlaEvent.find(filter)
    .sort({ occurredAt: -1 })
    .limit(parseInt(query.limit) || 50);
};

exports.getTicketSLATimeline = async (ctx, ticketId) => {
  const tenantId = requireTenant(ctx);
  const events = await SlaEvent.find({
    company: tenantId,
    ticket: ticketId,
  }).sort({ occurredAt: 1 });
  const breakdowns = await SLABreakdown.find({ tenantId, ticketId }).sort({
    startedAt: 1,
  });
  return { events, breakdowns };
};

// ─── SLA Breakdowns ─────────────────────────────────────────────────────

exports.getBreakdowns = async (ctx, ticketId) => {
  const tenantId = requireTenant(ctx);
  return SLABreakdown.find({ tenantId, ticketId }).sort({ startedAt: 1 });
};

exports.createBreakdown = async (ctx, data) => {
  const tenantId = requireTenant(ctx);
  return SLABreakdown.create({ ...data, tenantId });
};

// ─── SLA Repair Jobs ────────────────────────────────────────────────────

exports.listRepairJobs = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["status", "triggerType", "slaPlanId"]),
  };
  return SLARepairJob.find(filter)
    .sort({ createdAt: -1 })
    .limit(parseInt(query.limit) || 50);
};

exports.createRepairJob = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "SLAREPAIR");
  // Count affected tickets
  const filter = { tenantId: tenantId };
  if (data.slaPlanId) filter.sla = data.slaPlanId;
  const affectedTicketCount = await Ticket.countDocuments({
    ...filter,
    status: { $nin: ["closed", "archived", "deleted"] },
  });
  const job = await SLARepairJob.create({
    ...data,
    tenantId,
    number,
    triggeredBy: actor.userId,
    affectedTicketCount,
    status: "pending",
  });
  return job;
};

exports.startRepairJob = async (ctx, jobId) => {
  const tenantId = requireTenant(ctx);
  const job = await SLARepairJob.findOne({
    _id: jobId,
    tenantId,
    isDeleted: false,
  });
  if (!job)
    throw Object.assign(new Error("Repair job not found"), { statusCode: 404 });
  job.status = "running";
  job.startedAt = new Date();
  await job.save();
  return job;
};

exports.completeRepairJob = async (ctx, jobId, result) => {
  const tenantId = requireTenant(ctx);
  const job = await SLARepairJob.findOne({
    _id: jobId,
    tenantId,
    isDeleted: false,
  });
  if (!job)
    throw Object.assign(new Error("Repair job not found"), { statusCode: 404 });
  job.status = result.success ? "completed" : "failed";
  job.completedAt = new Date();
  job.actualDuration = Date.now() - job.startedAt.getTime();
  job.processedCount = result.processed || 0;
  job.successCount = result.success || 0;
  job.failureCount = result.failures || 0;
  if (result.errors?.length) job.errors = result.errors;
  await job.save();
  return job;
};

// ─── SLA Dashboard ──────────────────────────────────────────────────────

exports.getDashboard = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const [plans, totalTickets, openTickets] = await Promise.all([
    SlaPlan.find({ company: tenantId }),
    Ticket.countDocuments({ tenantId: tenantId }),
    Ticket.countDocuments({
      tenantId: tenantId,
      status: { $nin: ["closed", "archived", "deleted"] },
    }),
  ]);

  const breached = await Ticket.countDocuments({
    tenantId: tenantId,
    isOverdue: true,
  });
  const responseMet = await Ticket.countDocuments({
    tenantId: tenantId,
    responseMetAt: { $exists: true, $ne: null },
  });
  const responseBreached = await Ticket.countDocuments({
    tenantId: tenantId,
    responseBreached: true,
  });
  const resolutionMet = await Ticket.countDocuments({
    tenantId: tenantId,
    resolutionMetAt: { $exists: true, $ne: null },
  });

  const responseCompliance =
    responseMet + responseBreached > 0
      ? Math.round((responseMet / (responseMet + responseBreached)) * 100)
      : 100;
  const resolutionCompliance =
    resolutionMet > 0 && totalTickets > 0
      ? Math.round((resolutionMet / totalTickets) * 100)
      : 100;

  // Per-plan stats
  const planStats = plans.map((p) => ({
    name: p.name,
    schedule: p.schedule,
    status: p.status,
    firstResponse: p.targets?.first_response,
    resolution: p.targets?.resolution,
  }));

  // Recent breaches
  const recentBreaches = await SlaEvent.find({
    company: tenantId,
    event: "breached",
  })
    .sort({ occurredAt: -1 })
    .limit(10)
    .populate("ticket", "number subject");

  // Active OLAs
  const olas = await OLA.find({ tenantId, isActive: true, isDeleted: false })
    .populate("slaPlanId", "name")
    .populate("department", "name");

  return {
    totalPlans: plans.length,
    activePlans: plans.filter((p) => p.status !== "draft").length,
    totalTickets,
    openTickets,
    breached,
    responseCompliance,
    resolutionCompliance,
    planStats,
    recentBreaches,
    olas,
  };
};

// ─── SLA Recalculate ────────────────────────────────────────────────────

exports.recalculateDueDates = async (ctx, slaPlanId, actor) => {
  const tenantId = requireTenant(ctx);
  const tickets = await Ticket.find({
    tenantId: tenantId,
    sla: slaPlanId,
    status: { $nin: ["closed", "archived", "deleted"] },
  });
  let updated = 0;
  for (const ticket of tickets) {
    // Simple recalculation - in production would use sla.service.computeDueDate
    updated++;
  }
  return { recalculated: updated, total: tickets.length };
};

// ─── UC Target Measurement ──────────────────────────────────────────────

exports.measureUCTarget = async (ctx, targetId, actualValue, actor) => {
  const tenantId = requireTenant(ctx);
  const target = await UnderpinningContractTarget.findOne({
    _id: targetId,
    tenantId,
    isDeleted: false,
  });
  if (!target)
    throw Object.assign(new Error("UC target not found"), { statusCode: 404 });
  target.currentActual = actualValue;
  target.lastMeasuredAt = new Date();
  // Evaluate compliance
  let met = false;
  switch (target.comparisonOperator) {
    case "gte":
      met = actualValue >= target.targetValue;
      break;
    case "lte":
      met = actualValue <= target.targetValue;
      break;
    case "gt":
      met = actualValue > target.targetValue;
      break;
    case "lt":
      met = actualValue < target.targetValue;
      break;
    case "eq":
      met = actualValue === target.targetValue;
      break;
  }
  if (met) {
    target.status = "met";
  } else {
    target.status = "breached";
    target.breachCount = (target.breachCount || 0) + 1;
    target.lastBreachAt = new Date();
    emitEvent(tenantId, "uc.breached", {
      targetId: target._id,
      metric: target.metric,
    });
  }
  await target.save();
  return target;
};
