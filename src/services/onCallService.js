/**
 * On-Call Scheduling service — schedules, shifts, rosters, rotations,
 * coverage requests, time-off, escalation policies, and contact preferences.
 */
const mongoose = require("mongoose");
const numberingService = require("./numbering.service");
const auditEventService = require("./auditEventService");
const { emitEvent } = require("../realtime/socketManager");

// Register on-call schemas before retrieving the models from Mongoose.
require("../models/oncall/OnCallSchedule");
require("../models/oncall/Shift");
require("../models/oncall/Roster");
require("../models/oncall/RosterMember");
require("../models/oncall/Rotation");
require("../models/oncall/CoverageRequest");
require("../models/oncall/TimeOffRequest");
require("../models/oncall/EscalationPolicy");
require("../models/oncall/EscalationLevel");
require("../models/oncall/ContactPreference");

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

const OnCallSchedule = mongoose.model("OnCallSchedule");
const Shift = mongoose.model("Shift");
const Roster = mongoose.model("Roster");
const RosterMember = mongoose.model("RosterMember");
const Rotation = mongoose.model("Rotation");
const CoverageRequest = mongoose.model("CoverageRequest");
const TimeOffRequest = mongoose.model("TimeOffRequest");
const EscalationPolicy = mongoose.model("EscalationPolicy");
const EscalationLevel = mongoose.model("EscalationLevel");
const ContactPreference = mongoose.model("ContactPreference");

// ─── OnCallSchedule CRUD ────────────────────────────────────────────────

exports.listSchedules = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["status", "team", "scheduleType"]),
  };
  if (query.search)
    filter.$or = [{ name: { $regex: query.search, $options: "i" } }];
  return OnCallSchedule.find(filter).sort({ name: 1 });
};

exports.getSchedule = async (ctx, scheduleId) => {
  const tenantId = requireTenant(ctx);
  const sched = await OnCallSchedule.findOne({
    _id: scheduleId,
    tenantId,
    isDeleted: false,
  });
  if (!sched)
    throw Object.assign(new Error("On-call schedule not found"), {
      statusCode: 404,
    });
  return sched;
};

exports.createSchedule = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "OCS");
  return OnCallSchedule.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateSchedule = async (ctx, scheduleId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const sched = await OnCallSchedule.findOne({
    _id: scheduleId,
    tenantId,
    isDeleted: false,
  });
  if (!sched)
    throw Object.assign(new Error("On-call schedule not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "description",
    "timezone",
    "team",
    "status",
    "scheduleType",
    "startDate",
    "endDate",
    "handoverTime",
    "handoverDuration",
    "autoNotify",
    "notifyBeforeMinutes",
    "notifyChannels",
    "escalationPolicyId",
    "metadata",
  ];
  Object.assign(sched, pick(data, allowed));
  await sched.save();
  return sched;
};

exports.deleteSchedule = async (ctx, scheduleId, actor) => {
  const tenantId = requireTenant(ctx);
  const sched = await OnCallSchedule.findOne({
    _id: scheduleId,
    tenantId,
    isDeleted: false,
  });
  if (!sched)
    throw Object.assign(new Error("On-call schedule not found"), {
      statusCode: 404,
    });
  sched.isDeleted = true;
  sched.deletedAt = new Date();
  sched.deletedBy = actor.userId;
  await sched.save();
  return { success: true };
};

exports.publishSchedule = async (ctx, scheduleId, actor) => {
  const tenantId = requireTenant(ctx);
  const sched = await OnCallSchedule.findOne({
    _id: scheduleId,
    tenantId,
    isDeleted: false,
  });
  if (!sched)
    throw Object.assign(new Error("On-call schedule not found"), {
      statusCode: 404,
    });
  if (sched.status === "active")
    throw Object.assign(new Error("Schedule already active"), {
      statusCode: 400,
    });
  sched.status = "active";
  await sched.save();
  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "onCallSchedule.publish",
    entityType: "OnCallSchedule",
    entityId: scheduleId,
  });
  return sched;
};

// ─── Shift CRUD ─────────────────────────────────────────────────────────

exports.listShifts = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["scheduleId", "status", "onCallAgent"]),
  };
  if (query.from) filter.startDate = { $gte: new Date(query.from) };
  if (query.to)
    filter.endDate = { ...filter.endDate, $lte: new Date(query.to) };
  return Shift.find(filter)
    .sort({ startDate: 1 })
    .populate("onCallAgent", "name email");
};

exports.getShift = async (ctx, shiftId) => {
  const tenantId = requireTenant(ctx);
  const shift = await Shift.findOne({
    _id: shiftId,
    tenantId,
    isDeleted: false,
  }).populate("onCallAgent secondaryAgent", "name email");
  if (!shift)
    throw Object.assign(new Error("Shift not found"), { statusCode: 404 });
  return shift;
};

exports.createShift = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  return Shift.create({ ...data, tenantId, createdBy: actor.userId });
};

exports.updateShift = async (ctx, shiftId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const shift = await Shift.findOne({
    _id: shiftId,
    tenantId,
    isDeleted: false,
  });
  if (!shift)
    throw Object.assign(new Error("Shift not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "startDate",
    "endDate",
    "onCallAgent",
    "secondaryAgent",
    "status",
    "handoverNotes",
    "handoverCompleted",
    "handoverCompletedAt",
    "handoverCompletedBy",
    "escalationPolicySnapshot",
    "metadata",
  ];
  Object.assign(shift, pick(data, allowed));
  await shift.save();
  return shift;
};

exports.deleteShift = async (ctx, shiftId, actor) => {
  const tenantId = requireTenant(ctx);
  const shift = await Shift.findOne({
    _id: shiftId,
    tenantId,
    isDeleted: false,
  });
  if (!shift)
    throw Object.assign(new Error("Shift not found"), { statusCode: 404 });
  shift.isDeleted = true;
  shift.deletedAt = new Date();
  shift.deletedBy = actor.userId;
  await shift.save();
  return { success: true };
};

exports.completeHandover = async (ctx, shiftId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const shift = await Shift.findOne({
    _id: shiftId,
    tenantId,
    isDeleted: false,
  });
  if (!shift)
    throw Object.assign(new Error("Shift not found"), { statusCode: 404 });
  shift.handoverNotes = data.notes || "";
  shift.handoverCompleted = true;
  shift.handoverCompletedAt = new Date();
  shift.handoverCompletedBy = actor.userId;
  await shift.save();
  return shift;
};

// ─── Roster CRUD ────────────────────────────────────────────────────────

exports.listRosters = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["scheduleId", "status"]),
  };
  return Roster.find(filter).sort({ startDate: 1 });
};

exports.getRoster = async (ctx, rosterId) => {
  const tenantId = requireTenant(ctx);
  const roster = await Roster.findOne({
    _id: rosterId,
    tenantId,
    isDeleted: false,
  });
  if (!roster)
    throw Object.assign(new Error("Roster not found"), { statusCode: 404 });
  return roster;
};

exports.createRoster = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  return Roster.create({ ...data, tenantId, createdBy: actor.userId });
};

exports.updateRoster = async (ctx, rosterId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const roster = await Roster.findOne({
    _id: rosterId,
    tenantId,
    isDeleted: false,
  });
  if (!roster)
    throw Object.assign(new Error("Roster not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "description",
    "startDate",
    "endDate",
    "status",
    "rotation",
    "assignedMembers",
    "minCoverage",
    "maxCoverage",
    "handoverWindow",
    "metadata",
  ];
  Object.assign(roster, pick(data, allowed));
  await roster.save();
  return roster;
};

exports.deleteRoster = async (ctx, rosterId, actor) => {
  const tenantId = requireTenant(ctx);
  const roster = await Roster.findOne({
    _id: rosterId,
    tenantId,
    isDeleted: false,
  });
  if (!roster)
    throw Object.assign(new Error("Roster not found"), { statusCode: 404 });
  roster.isDeleted = true;
  roster.deletedAt = new Date();
  roster.deletedBy = actor.userId;
  await roster.save();
  return { success: true };
};

// ─── RosterMember CRUD ─────────────────────────────────────────────────

exports.listRosterMembers = async (ctx, rosterId) => {
  const tenantId = requireTenant(ctx);
  return RosterMember.find({ tenantId, rosterId, isActive: true }).populate(
    "userId",
    "name email",
  );
};

exports.addRosterMember = async (ctx, rosterId, data, actor) => {
  const tenantId = requireTenant(ctx);
  return RosterMember.create({
    tenantId,
    rosterId,
    ...data,
    createdBy: actor.userId,
  });
};

exports.removeRosterMember = async (ctx, rosterId, userId) => {
  const tenantId = requireTenant(ctx);
  return RosterMember.findOneAndDelete({ tenantId, rosterId, userId });
};

// ─── Rotation CRUD ─────────────────────────────────────────────────────

exports.listRotations = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, ...pick(query, ["scheduleId", "status"]) };
  return Rotation.find(filter).sort({ name: 1 });
};

exports.getRotation = async (ctx, rotationId) => {
  const tenantId = requireTenant(ctx);
  const rot = await Rotation.findOne({ _id: rotationId, tenantId });
  if (!rot)
    throw Object.assign(new Error("Rotation not found"), { statusCode: 404 });
  return rot;
};

exports.createRotation = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  return Rotation.create({ ...data, tenantId, createdBy: actor.userId });
};

exports.updateRotation = async (ctx, rotationId, data) => {
  const tenantId = requireTenant(ctx);
  const rot = await Rotation.findOne({ _id: rotationId, tenantId });
  if (!rot)
    throw Object.assign(new Error("Rotation not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "type",
    "pattern",
    "members",
    "currentIndex",
    "nextHandoverDate",
    "status",
    "metadata",
  ];
  Object.assign(rot, pick(data, allowed));
  await rot.save();
  return rot;
};

exports.deleteRotation = async (ctx, rotationId, actor) => {
  const tenantId = requireTenant(ctx);
  await Rotation.findOneAndDelete({ _id: rotationId, tenantId });
  return { success: true };
};

exports.advanceRotation = async (ctx, rotationId) => {
  const tenantId = requireTenant(ctx);
  const rot = await Rotation.findOne({ _id: rotationId, tenantId });
  if (!rot)
    throw Object.assign(new Error("Rotation not found"), { statusCode: 404 });
  rot.currentIndex = (rot.currentIndex + 1) % rot.members.length;
  rot.nextHandoverDate = addDays(
    rot.nextHandoverDate,
    rot.pattern.durationDays,
  );
  await rot.save();
  return rot;
};

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── CoverageRequest CRUD ──────────────────────────────────────────────

exports.listCoverageRequests = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    ...pick(query, ["scheduleId", "shiftId", "requesterId", "status", "type"]),
  };
  return CoverageRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate("requesterId targetUserId", "name email");
};

exports.getCoverageRequest = async (ctx, requestId) => {
  const tenantId = requireTenant(ctx);
  const cr = await CoverageRequest.findOne({ _id: requestId, tenantId });
  if (!cr)
    throw Object.assign(new Error("Coverage request not found"), {
      statusCode: 404,
    });
  return cr;
};

exports.createCoverageRequest = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  return CoverageRequest.create({
    ...data,
    tenantId,
    requesterId: actor.userId,
    createdBy: actor.userId,
  });
};

exports.approveCoverageRequest = async (ctx, requestId, actor) => {
  const tenantId = requireTenant(ctx);
  const cr = await CoverageRequest.findOne({ _id: requestId, tenantId });
  if (!cr)
    throw Object.assign(new Error("Coverage request not found"), {
      statusCode: 404,
    });
  cr.status = "approved";
  cr.approvedBy = actor.userId;
  cr.approvedAt = new Date();
  await cr.save();
  return cr;
};

exports.rejectCoverageRequest = async (ctx, requestId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const cr = await CoverageRequest.findOne({ _id: requestId, tenantId });
  if (!cr)
    throw Object.assign(new Error("Coverage request not found"), {
      statusCode: 404,
    });
  cr.status = "rejected";
  cr.rejectedBy = actor.userId;
  cr.rejectedAt = new Date();
  cr.rejectionReason = data.reason || "";
  await cr.save();
  return cr;
};

// ─── TimeOffRequest CRUD ───────────────────────────────────────────────

exports.listTimeOffRequests = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    ...pick(query, ["scheduleId", "userId", "status"]),
  };
  return TimeOffRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate("userId", "name email");
};

exports.getTimeOffRequest = async (ctx, requestId) => {
  const tenantId = requireTenant(ctx);
  const tor = await TimeOffRequest.findOne({ _id: requestId, tenantId });
  if (!tor)
    throw Object.assign(new Error("Time-off request not found"), {
      statusCode: 404,
    });
  return tor;
};

exports.createTimeOffRequest = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  return TimeOffRequest.create({
    ...data,
    tenantId,
    userId: actor.userId,
    createdBy: actor.userId,
  });
};

exports.approveTimeOffRequest = async (ctx, requestId, actor) => {
  const tenantId = requireTenant(ctx);
  const tor = await TimeOffRequest.findOne({ _id: requestId, tenantId });
  if (!tor)
    throw Object.assign(new Error("Time-off request not found"), {
      statusCode: 404,
    });
  tor.status = "approved";
  tor.approvedBy = actor.userId;
  tor.approvedAt = new Date();
  await tor.save();
  return tor;
};

exports.rejectTimeOffRequest = async (ctx, requestId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const tor = await TimeOffRequest.findOne({ _id: requestId, tenantId });
  if (!tor)
    throw Object.assign(new Error("Time-off request not found"), {
      statusCode: 404,
    });
  tor.status = "rejected";
  tor.rejectedBy = actor.userId;
  tor.rejectedAt = new Date();
  tor.rejectionReason = data.reason || "";
  await tor.save();
  return tor;
};

// ─── EscalationPolicy CRUD ─────────────────────────────────────────────

exports.listEscalationPolicies = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["isActive", "team", "isDefault"]),
  };
  return EscalationPolicy.find(filter).sort({ name: 1 });
};

exports.getEscalationPolicy = async (ctx, policyId) => {
  const tenantId = requireTenant(ctx);
  const policy = await EscalationPolicy.findOne({
    _id: policyId,
    tenantId,
    isDeleted: false,
  });
  if (!policy)
    throw Object.assign(new Error("Escalation policy not found"), {
      statusCode: 404,
    });
  return policy;
};

exports.createEscalationPolicy = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "EP");
  return EscalationPolicy.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateEscalationPolicy = async (ctx, policyId, data) => {
  const tenantId = requireTenant(ctx);
  const policy = await EscalationPolicy.findOne({
    _id: policyId,
    tenantId,
    isDeleted: false,
  });
  if (!policy)
    throw Object.assign(new Error("Escalation policy not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "description",
    "isActive",
    "isDefault",
    "team",
    "repeatAfterMinutes",
    "maxRepeats",
    "onCallOnly",
    "metadata",
  ];
  Object.assign(policy, pick(data, allowed));
  await policy.save();
  return policy;
};

exports.deleteEscalationPolicy = async (ctx, policyId, actor) => {
  const tenantId = requireTenant(ctx);
  const policy = await EscalationPolicy.findOne({
    _id: policyId,
    tenantId,
    isDeleted: false,
  });
  if (!policy)
    throw Object.assign(new Error("Escalation policy not found"), {
      statusCode: 404,
    });
  policy.isDeleted = true;
  policy.deletedAt = new Date();
  policy.deletedBy = actor.userId;
  await policy.save();
  return { success: true };
};

// ─── EscalationLevel CRUD ──────────────────────────────────────────────

exports.listEscalationLevels = async (ctx, policyId) => {
  const tenantId = requireTenant(ctx);
  return EscalationLevel.find({ tenantId, policyId }).sort({ level: 1 });
};

exports.createEscalationLevel = async (ctx, policyId, data) => {
  const tenantId = requireTenant(ctx);
  const policy = await EscalationPolicy.findOne({
    _id: policyId,
    tenantId,
    isDeleted: false,
  });
  if (!policy)
    throw Object.assign(new Error("Escalation policy not found"), {
      statusCode: 404,
    });
  return EscalationLevel.create({ ...data, tenantId, policyId });
};

exports.updateEscalationLevel = async (ctx, levelId, data) => {
  const tenantId = requireTenant(ctx);
  const level = await EscalationLevel.findOne({ _id: levelId, tenantId });
  if (!level)
    throw Object.assign(new Error("Escalation level not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "delayMinutes",
    "targets",
    "notifyUntilAcknowledged",
    "acknowledgementTimeoutMinutes",
    "autoEscalateIfNoAck",
    "metadata",
  ];
  Object.assign(level, pick(data, allowed));
  await level.save();
  return level;
};

exports.deleteEscalationLevel = async (ctx, levelId) => {
  const tenantId = requireTenant(ctx);
  await EscalationLevel.findOneAndDelete({ _id: levelId, tenantId });
  return { success: true };
};

// ─── ContactPreference CRUD ────────────────────────────────────────────

exports.getContactPreference = async (ctx, userId) => {
  const tenantId = requireTenant(ctx);
  let pref = await ContactPreference.findOne({ tenantId, userId });
  if (!pref) pref = await ContactPreference.create({ tenantId, userId });
  return pref;
};

exports.updateContactPreference = async (ctx, userId, data) => {
  const tenantId = requireTenant(ctx);
  let pref = await ContactPreference.findOne({ tenantId, userId });
  if (!pref) pref = await ContactPreference.create({ tenantId, userId });
  const allowed = [
    "onCallEmail",
    "onCallSms",
    "onCallVoice",
    "onCallSlack",
    "onCallTeams",
    "preferredOrder",
    "quietHours",
    "escalationMode",
    "acknowledgeTimeoutMinutes",
    "metadata",
  ];
  Object.assign(pref, pick(data, allowed));
  await pref.save();
  return pref;
};

// ─── Current On-Call Resolution ────────────────────────────────────────

exports.getCurrentOnCall = async (ctx, scheduleId) => {
  const tenantId = requireTenant(ctx);
  const now = new Date();
  const shift = await Shift.findOne({
    tenantId,
    scheduleId,
    isDeleted: false,
    startDate: { $lte: now },
    endDate: { $gte: now },
    status: { $in: ["scheduled", "active"] },
  }).populate("onCallAgent secondaryAgent", "name email");
  return shift;
};

exports.getUpcomingShifts = async (ctx, scheduleId, days = 7) => {
  const tenantId = requireTenant(ctx);
  const now = new Date();
  const future = new Date(now.getTime() + days * 86400000);
  return Shift.find({
    tenantId,
    scheduleId,
    isDeleted: false,
    startDate: { $gte: now, $lte: future },
    status: { $in: ["scheduled", "active"] },
  })
    .sort({ startDate: 1 })
    .populate("onCallAgent secondaryAgent", "name email");
};

exports.getOnCallAgentForTeam = async (ctx, teamId) => {
  const tenantId = requireTenant(ctx);
  const schedule = await OnCallSchedule.findOne({
    tenantId,
    team: teamId,
    status: "active",
    isDeleted: false,
  });
  if (!schedule) return null;
  return exports.getCurrentOnCall(ctx, schedule._id);
};

// ─── Gap Detection ─────────────────────────────────────────────────────

exports.detectGaps = async (ctx, scheduleId, days = 14) => {
  const tenantId = requireTenant(ctx);
  const now = new Date();
  const future = new Date(now.getTime() + days * 86400000);
  const shifts = await Shift.find({
    tenantId,
    scheduleId,
    isDeleted: false,
    startDate: { $gte: now, $lte: future },
    status: { $ne: "cancelled" },
  }).sort({ startDate: 1 });

  const gaps = [];
  let prevEnd = now;
  for (const shift of shifts) {
    if (shift.startDate > prevEnd) {
      gaps.push({
        from: prevEnd,
        to: shift.startDate,
        durationMinutes: (shift.startDate - prevEnd) / 60000,
      });
    }
    prevEnd = shift.endDate;
  }
  return { scheduleId, gaps };
};

// ─── Dashboard / Stats ─────────────────────────────────────────────────

exports.getDashboard = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const [schedules, shifts, rosters, coverage, timeOff, policies, contacts] =
    await Promise.all([
      OnCallSchedule.find({ tenantId, isDeleted: false }),
      Shift.find({
        tenantId,
        isDeleted: false,
        startDate: { $gte: new Date() },
      }),
      Roster.find({ tenantId, isDeleted: false }),
      CoverageRequest.find({ tenantId, status: "pending" }),
      TimeOffRequest.find({ tenantId, status: "pending" }),
      EscalationPolicy.find({ tenantId, isDeleted: false }),
      ContactPreference.find({ tenantId }),
    ]);

  const activeSchedules = schedules.filter((s) => s.status === "active").length;
  const upcomingShifts = shifts.filter(
    (s) => s.status === "scheduled" || s.status === "active",
  ).length;
  const conflicts = shifts.filter((s) => s.status === "conflict").length;

  return {
    totalSchedules: schedules.length,
    activeSchedules,
    upcomingShifts,
    activeRosters: rosters.filter((r) => r.status === "published").length,
    pendingCoverage: coverage.length,
    pendingTimeOff: timeOff.length,
    escalationPolicies: policies.length,
    activePolicies: policies.filter((p) => p.isActive).length,
    contactsConfigured: contacts.filter((c) => c.preferredOrder?.length).length,
    conflicts,
  };
};

// ─── Shift Notification Job ────────────────────────────────────────────

exports.notifyUpcomingShifts = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const now = new Date();
  const notifyWindow = new Date(now.getTime() + 60 * 60000); // next hour

  const shifts = await Shift.find({
    tenantId,
    isDeleted: false,
    startDate: { $gte: now, $lte: notifyWindow },
    status: "scheduled",
  }).populate("onCallAgent secondaryAgent", "name email");

  let notified = 0;
  for (const shift of shifts) {
    const agents = [shift.onCallAgent, shift.secondaryAgent].filter(Boolean);
    for (const agent of agents) {
      // In production: use notification service
      emitEvent(tenantId, "oncall.shift.upcoming", {
        shiftId: shift._id,
        scheduleId: shift.scheduleId,
        startDate: shift.startDate,
        endDate: shift.endDate,
        agentId: agent._id,
        agentName: agent.name,
      });
      notified++;
    }
  }
  return { notified };
};

module.exports.addDays = addDays;
