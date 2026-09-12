/**
 * Walk-Up Experience service — locations, services, queues, check-ins,
 * appointments, interactions, kiosks, and wait-time estimation.
 */
const mongoose = require("mongoose");
const numberingService = require("./numbering.service");
const auditEventService = require("./auditEventService");
const { emitEvent } = require("../realtime/socketManager");

// Register walk-up schemas before retrieving their models from Mongoose.
require("../models/walkup/WalkupLocation");
require("../models/walkup/WalkupService");
require("../models/walkup/WalkupQueue");
require("../models/walkup/WalkupCheckin");
require("../models/walkup/Appointment");
require("../models/walkup/WalkupInteraction");
require("../models/walkup/Kiosk");
require("../models/walkup/WaitTimeEvent");
require("../models/User");
require("../models/Team");

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

const WalkupLocation = mongoose.model("WalkupLocation");
const WalkupService = mongoose.model("WalkupService");
const WalkupQueue = mongoose.model("WalkupQueue");
const WalkupCheckin = mongoose.model("WalkupCheckin");
const Appointment = mongoose.model("Appointment");
const WalkupInteraction = mongoose.model("WalkupInteraction");
const Kiosk = mongoose.model("Kiosk");
const WaitTimeEvent = mongoose.model("WaitTimeEvent");
const User = mongoose.model("User");
const Team = mongoose.model("Team");

// ─── Location CRUD ──────────────────────────────────────────────────────

exports.listLocations = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["status", "team"]),
  };
  if (query.search)
    filter.$or = [{ name: { $regex: query.search, $options: "i" } }];
  return WalkupLocation.find(filter).sort({ name: 1 });
};

exports.getLocation = async (ctx, locationId) => {
  const tenantId = requireTenant(ctx);
  const loc = await WalkupLocation.findOne({
    _id: locationId,
    tenantId,
    isDeleted: false,
  });
  if (!loc)
    throw Object.assign(new Error("Walk-up location not found"), {
      statusCode: 404,
    });
  return loc;
};

exports.createLocation = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "WLOC");
  return WalkupLocation.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateLocation = async (ctx, locationId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const loc = await WalkupLocation.findOne({
    _id: locationId,
    tenantId,
    isDeleted: false,
  });
  if (!loc)
    throw Object.assign(new Error("Walk-up location not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "description",
    "address",
    "floor",
    "room",
    "timezone",
    "hours",
    "exceptions",
    "services",
    "kiosks",
    "team",
    "maxConcurrentCheckins",
    "waitTimeEstimation",
    "autoAssign",
    "checkinMethods",
    "status",
    "metadata",
  ];
  Object.assign(loc, pick(data, allowed));
  await loc.save();
  return loc;
};

exports.deleteLocation = async (ctx, locationId, actor) => {
  const tenantId = requireTenant(ctx);
  const loc = await WalkupLocation.findOne({
    _id: locationId,
    tenantId,
    isDeleted: false,
  });
  if (!loc)
    throw Object.assign(new Error("Walk-up location not found"), {
      statusCode: 404,
    });
  loc.isDeleted = true;
  loc.deletedAt = new Date();
  loc.deletedBy = actor.userId;
  await loc.save();
  return { success: true };
};

exports.getOpenLocations = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const now = new Date();
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const day = dayNames[now.getDay()];
  const time = now.toTimeString().slice(0, 5);

  const locations = await WalkupLocation.find({
    tenantId,
    status: "active",
    isDeleted: false,
  });
  return locations.filter((loc) => {
    const hours = loc.hours[day];
    if (hours.closed) return false;
    return time >= hours.open && time <= hours.close;
  });
};

// ─── Service CRUD ──────────────────────────────────────────────────────

exports.listServices = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["status", "category", "locationId"]),
  };
  if (query.search)
    filter.$or = [{ name: { $regex: query.search, $options: "i" } }];
  return WalkupService.find(filter).sort({ name: 1 });
};

exports.getService = async (ctx, serviceId) => {
  const tenantId = requireTenant(ctx);
  const svc = await WalkupService.findOne({
    _id: serviceId,
    tenantId,
    isDeleted: false,
  });
  if (!svc)
    throw Object.assign(new Error("Walk-up service not found"), {
      statusCode: 404,
    });
  return svc;
};

exports.createService = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "WSVC");
  return WalkupService.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateService = async (ctx, serviceId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const svc = await WalkupService.findOne({
    _id: serviceId,
    tenantId,
    isDeleted: false,
  });
  if (!svc)
    throw Object.assign(new Error("Walk-up service not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "description",
    "category",
    "locations",
    "estimatedDuration",
    "requiresAppointment",
    "allowsWalkin",
    "requiresApproval",
    "requiresAsset",
    "skillRequired",
    "slaTargetMinutes",
    "autoCreateTicket",
    "ticketTemplate",
    "status",
    "metadata",
  ];
  Object.assign(svc, pick(data, allowed));
  await svc.save();
  return svc;
};

exports.deleteService = async (ctx, serviceId, actor) => {
  const tenantId = requireTenant(ctx);
  const svc = await WalkupService.findOne({
    _id: serviceId,
    tenantId,
    isDeleted: false,
  });
  if (!svc)
    throw Object.assign(new Error("Walk-up service not found"), {
      statusCode: 404,
    });
  svc.isDeleted = true;
  svc.deletedAt = new Date();
  svc.deletedBy = actor.userId;
  await svc.save();
  return { success: true };
};

// ─── Queue CRUD ────────────────────────────────────────────────────────

exports.listQueues = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["locationId", "serviceId", "status"]),
  };
  return WalkupQueue.find(filter).sort({ name: 1 });
};

exports.getQueue = async (ctx, queueId) => {
  const tenantId = requireTenant(ctx);
  const queue = await WalkupQueue.findOne({
    _id: queueId,
    tenantId,
    isDeleted: false,
  });
  if (!queue)
    throw Object.assign(new Error("Queue not found"), { statusCode: 404 });
  return queue;
};

exports.createQueue = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "WQ");
  return WalkupQueue.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateQueue = async (ctx, queueId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const queue = await WalkupQueue.findOne({
    _id: queueId,
    tenantId,
    isDeleted: false,
  });
  if (!queue)
    throw Object.assign(new Error("Queue not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "serviceId",
    "status",
    "maxSize",
    "priorityHandling",
    "autoEstimateWait",
    "metadata",
  ];
  Object.assign(queue, pick(data, allowed));
  await queue.save();
  return queue;
};

exports.deleteQueue = async (ctx, queueId, actor) => {
  const tenantId = requireTenant(ctx);
  const queue = await WalkupQueue.findOne({
    _id: queueId,
    tenantId,
    isDeleted: false,
  });
  if (!queue)
    throw Object.assign(new Error("Queue not found"), { statusCode: 404 });
  queue.isDeleted = true;
  queue.deletedAt = new Date();
  queue.deletedBy = actor.userId;
  await queue.save();
  return { success: true };
};

exports.updateQueueStats = async (queueId, tenantId) => {
  const queue = await WalkupQueue.findOne({
    _id: queueId,
    tenantId,
    isDeleted: false,
  });
  if (!queue) return;
  const waiting = await WalkupCheckin.countDocuments({
    tenantId,
    queueId,
    status: "waiting",
  });
  queue.currentSize = waiting;
  if (queue.autoEstimateWait) {
    const recent = await WaitTimeEvent.find({ tenantId, queueId })
      .sort({ timestamp: -1 })
      .limit(10);
    if (recent.length) {
      queue.avgWaitMinutes = Math.round(
        recent.reduce((s, e) => s + e.waitTimeMinutes, 0) / recent.length,
      );
      queue.estimatedWaitMinutes = queue.avgWaitMinutes * Math.max(1, waiting);
    }
  }
  await queue.save();
  return queue;
};

// ─── Check-in Logic ────────────────────────────────────────────────────

exports.checkIn = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);

  // Validate queue
  const queue = await WalkupQueue.findOne({
    _id: data.queueId,
    tenantId,
    isDeleted: false,
  });
  if (!queue)
    throw Object.assign(new Error("Queue not found"), { statusCode: 404 });
  if (queue.status !== "open")
    throw Object.assign(new Error("Queue is not open"), { statusCode: 400 });
  if (queue.currentSize >= queue.maxSize)
    throw Object.assign(new Error("Queue is full"), { statusCode: 400 });

  // Generate queue number
  const queueNumber = queue.nextNumber++;
  await queue.save();

  // Create check-in
  const checkin = await WalkupCheckin.create({
    tenantId,
    locationId: queue.locationId,
    queueId: queue._id,
    serviceId: data.serviceId,
    appointmentId: data.appointmentId,
    kioskId: data.kioskId,
    number: await numberingService.nextNumber(tenantId, "WCHK"),
    queueNumber,
    userId: data.userId,
    userName: data.userName,
    userEmail: data.userEmail,
    userPhone: data.userPhone,
    checkinMethod: data.checkinMethod,
    reason: data.reason,
    notes: data.notes,
    priority: data.priority || 0,
    checkinAt: new Date(),
  });

  // Update queue stats
  await exports.updateQueueStats(queue._id, tenantId);

  // Record wait time event
  await WaitTimeEvent.create({
    tenantId,
    queueId: queue._id,
    checkinId: checkin._id,
    queueSize: queue.currentSize,
    waitTimeMinutes: queue.estimatedWaitMinutes,
    eventType: "checkin",
  });

  emitEvent(tenantId, "walkup.checkin", {
    checkinId: checkin._id,
    queueNumber,
    queueId: queue._id,
  });
  return checkin;
};

exports.callCheckin = async (ctx, checkinId, technicianId, technicianName) => {
  const tenantId = requireTenant(ctx);
  const checkin = await WalkupCheckin.findOne({ _id: checkinId, tenantId });
  if (!checkin)
    throw Object.assign(new Error("Check-in not found"), { statusCode: 404 });
  if (checkin.status !== "waiting")
    throw Object.assign(new Error("Check-in not in waiting status"), {
      statusCode: 400,
    });

  checkin.status = "called";
  checkin.calledAt = new Date();
  checkin.technicianId = technicianId;
  checkin.technicianName = technicianName;
  await checkin.save();

  // Record wait time
  if (checkin.checkinAt) {
    checkin.waitMinutes = Math.round((new Date() - checkin.checkinAt) / 60000);
  }

  await WaitTimeEvent.create({
    tenantId,
    queueId: checkin.queueId,
    checkinId: checkin._id,
    queueSize: await WalkupCheckin.countDocuments({
      tenantId,
      queueId: checkin.queueId,
      status: "waiting",
    }),
    waitTimeMinutes: checkin.waitMinutes,
    eventType: "called",
  });

  emitEvent(tenantId, "walkup.called", {
    checkinId,
    queueNumber: checkin.queueNumber,
    technicianName,
  });
  return checkin;
};

exports.startService = async (ctx, checkinId, technicianId, technicianName) => {
  const tenantId = requireTenant(ctx);
  const checkin = await WalkupCheckin.findOne({ _id: checkinId, tenantId });
  if (!checkin)
    throw Object.assign(new Error("Check-in not found"), { statusCode: 404 });
  if (checkin.status !== "called" && checkin.status !== "waiting")
    throw Object.assign(new Error("Check-in not in callable status"), {
      statusCode: 400,
    });

  checkin.status = "in_service";
  checkin.startedAt = new Date();
  checkin.technicianId = technicianId;
  checkin.technicianName = technicianName;
  await checkin.save();

  await WaitTimeEvent.create({
    tenantId,
    queueId: checkin.queueId,
    checkinId: checkin._id,
    queueSize: await WalkupCheckin.countDocuments({
      tenantId,
      queueId: checkin.queueId,
      status: "waiting",
    }),
    waitTimeMinutes: checkin.waitMinutes,
    eventType: "started",
  });

  emitEvent(tenantId, "walkup.started", { checkinId, technicianName });
  return checkin;
};

exports.completeCheckin = async (ctx, checkinId, data) => {
  const tenantId = requireTenant(ctx);
  const checkin = await WalkupCheckin.findOne({ _id: checkinId, tenantId });
  if (!checkin)
    throw Object.assign(new Error("Check-in not found"), { statusCode: 404 });
  if (checkin.status !== "in_service")
    throw Object.assign(new Error("Check-in not in service"), {
      statusCode: 400,
    });

  checkin.status = "completed";
  checkin.completedAt = new Date();
  if (checkin.startedAt) {
    checkin.serviceMinutes = Math.round(
      (new Date() - checkin.startedAt) / 60000,
    );
  }
  checkin.outcome = data.outcome || "resolved";
  checkin.ticketId = data.ticketId;
  checkin.incidentId = data.incidentId;
  checkin.requestId = data.requestId;
  checkin.notes = data.notes || checkin.notes;
  checkin.satisfactionRating = data.satisfactionRating;
  checkin.satisfactionComment = data.satisfactionComment || "";
  await checkin.save();

  // Update queue stats
  const queue = await WalkupQueue.findById(checkin.queueId);
  if (queue) {
    queue.currentServing = null;
    await exports.updateQueueStats(queue._id, tenantId);
  }

  await WaitTimeEvent.create({
    tenantId,
    queueId: checkin.queueId,
    checkinId: checkin._id,
    queueSize: await WalkupCheckin.countDocuments({
      tenantId,
      queueId: checkin.queueId,
      status: "waiting",
    }),
    waitTimeMinutes: checkin.waitMinutes,
    servedCount: 1,
    eventType: "completed",
  });

  emitEvent(tenantId, "walkup.completed", {
    checkinId,
    outcome: checkin.outcome,
  });
  return checkin;
};

exports.cancelCheckin = async (ctx, checkinId, actor) => {
  const tenantId = requireTenant(ctx);
  const checkin = await WalkupCheckin.findOne({ _id: checkinId, tenantId });
  if (!checkin)
    throw Object.assign(new Error("Check-in not found"), { statusCode: 404 });
  if (["completed", "cancelled", "no_show"].includes(checkin.status))
    throw Object.assign(new Error("Check-in already finalized"), {
      statusCode: 400,
    });

  checkin.status = "cancelled";
  await checkin.save();

  await WaitTimeEvent.create({
    tenantId,
    queueId: checkin.queueId,
    checkinId: checkin._id,
    queueSize: await WalkupCheckin.countDocuments({
      tenantId,
      queueId: checkin.queueId,
      status: "waiting",
    }),
    waitTimeMinutes: checkin.waitMinutes,
    abandonedCount: 1,
    eventType: "abandoned",
  });

  await exports.updateQueueStats(checkin.queueId, tenantId);
  emitEvent(tenantId, "walkup.cancelled", { checkinId });
  return checkin;
};

// ─── Appointment CRUD ──────────────────────────────────────────────────

exports.listAppointments = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["locationId", "serviceId", "status", "userId"]),
  };
  if (query.from) filter.scheduledAt = { $gte: new Date(query.from) };
  if (query.to)
    filter.scheduledAt = { ...filter.scheduledAt, $lte: new Date(query.to) };
  return Appointment.find(filter).sort({ scheduledAt: 1 });
};

exports.getAppointment = async (ctx, appointmentId) => {
  const tenantId = requireTenant(ctx);
  const appt = await Appointment.findOne({
    _id: appointmentId,
    tenantId,
    isDeleted: false,
  });
  if (!appt)
    throw Object.assign(new Error("Appointment not found"), {
      statusCode: 404,
    });
  return appt;
};

exports.createAppointment = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "WAPT");
  return Appointment.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateAppointment = async (ctx, appointmentId, data) => {
  const tenantId = requireTenant(ctx);
  const appt = await Appointment.findOne({
    _id: appointmentId,
    tenantId,
    isDeleted: false,
  });
  if (!appt)
    throw Object.assign(new Error("Appointment not found"), {
      statusCode: 404,
    });
  const allowed = [
    "locationId",
    "serviceId",
    "scheduledAt",
    "durationMinutes",
    "status",
    "checkinMethod",
    "reminderSent",
    "checkinAt",
    "startedAt",
    "completedAt",
    "technicianId",
    "technicianName",
    "reason",
    "notes",
    "outcome",
    "ticketId",
    "incidentId",
    "requestId",
    "metadata",
  ];
  Object.assign(appt, pick(data, allowed));
  await appt.save();
  return appt;
};

exports.checkinAppointment = async (ctx, appointmentId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const appt = await Appointment.findOne({
    _id: appointmentId,
    tenantId,
    isDeleted: false,
  });
  if (!appt)
    throw Object.assign(new Error("Appointment not found"), {
      statusCode: 404,
    });
  if (!["scheduled", "confirmed"].includes(appt.status))
    throw Object.assign(new Error("Appointment not in check-inable status"), {
      statusCode: 400,
    });

  appt.status = "checked_in";
  appt.checkinMethod = data.checkinMethod;
  appt.checkinAt = new Date();
  await appt.save();

  // Create check-in for appointment
  const checkin = await exports.checkIn(
    ctx,
    {
      queueId: appt.queueId,
      serviceId: appt.serviceId,
      appointmentId: appt._id,
      kioskId: data.kioskId,
      userId: appt.userId,
      userName: appt.userName,
      userEmail: appt.userEmail,
      userPhone: appt.userPhone,
      checkinMethod: data.checkinMethod || "appointment",
      reason: appt.reason,
      priority: 1,
    },
    actor,
  );

  return { appointment: appt, checkin };
};

exports.cancelAppointment = async (ctx, appointmentId, actor) => {
  const tenantId = requireTenant(ctx);
  const appt = await Appointment.findOne({
    _id: appointmentId,
    tenantId,
    isDeleted: false,
  });
  if (!appt)
    throw Object.assign(new Error("Appointment not found"), {
      statusCode: 404,
    });
  appt.status = "cancelled";
  await appt.save();
  return appt;
};

// ─── Interactions ──────────────────────────────────────────────────────

exports.createInteraction = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  return WalkupInteraction.create({
    ...data,
    tenantId,
    createdBy: actor.userId,
  });
};

exports.getInteraction = async (ctx, interactionId) => {
  const tenantId = requireTenant(ctx);
  const interaction = await WalkupInteraction.findOne({
    _id: interactionId,
    tenantId,
  });
  if (!interaction)
    throw Object.assign(new Error("Interaction not found"), {
      statusCode: 404,
    });
  return interaction;
};

exports.completeInteraction = async (ctx, interactionId, data) => {
  const tenantId = requireTenant(ctx);
  const interaction = await WalkupInteraction.findOne({
    _id: interactionId,
    tenantId,
  });
  if (!interaction)
    throw Object.assign(new Error("Interaction not found"), {
      statusCode: 404,
    });

  interaction.endedAt = new Date();
  interaction.durationMinutes = Math.round(
    (new Date() - interaction.startedAt) / 60000,
  );
  interaction.resolution = data.resolution;
  interaction.outcome = data.outcome;
  interaction.assetsInvolved = data.assetsInvolved || [];
  interaction.assetsProvided = data.assetsProvided || [];
  interaction.softwareInvolved = data.softwareInvolved || [];
  interaction.followUpRequired = data.followUpRequired || false;
  interaction.followUpNotes = data.followUpNotes || "";
  interaction.ticketId = data.ticketId;
  interaction.incidentId = data.incidentId;
  interaction.requestId = data.requestId;
  interaction.changeId = data.changeId;
  interaction.satisfactionRating = data.satisfactionRating;
  interaction.satisfactionComment = data.satisfactionComment || "";
  await interaction.save();

  emitEvent(tenantId, "walkup.interaction.completed", {
    interactionId,
    outcome: interaction.outcome,
  });
  return interaction;
};

// ─── Kiosk CRUD ────────────────────────────────────────────────────────

exports.listKiosks = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["locationId", "status"]),
  };
  return Kiosk.find(filter).sort({ name: 1 });
};

exports.getKiosk = async (ctx, kioskId) => {
  const tenantId = requireTenant(ctx);
  const kiosk = await Kiosk.findOne({
    _id: kioskId,
    tenantId,
    isDeleted: false,
  });
  if (!kiosk)
    throw Object.assign(new Error("Kiosk not found"), { statusCode: 404 });
  return kiosk;
};

exports.createKiosk = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "KIOSK");
  return Kiosk.create({ ...data, tenantId, number, createdBy: actor.userId });
};

exports.updateKiosk = async (ctx, kioskId, data) => {
  const tenantId = requireTenant(ctx);
  const kiosk = await Kiosk.findOne({
    _id: kioskId,
    tenantId,
    isDeleted: false,
  });
  if (!kiosk)
    throw Object.assign(new Error("Kiosk not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "description",
    "serialNumber",
    "ipAddress",
    "macAddress",
    "status",
    "hardwareInfo",
    "softwareVersion",
    "configuredServices",
    "uiTheme",
    "printerEnabled",
    "printerConfig",
    "scannerEnabled",
    "cameraEnabled",
    "cardReaderEnabled",
    "lastConfigUpdate",
    "metadata",
  ];
  Object.assign(kiosk, pick(data, allowed));
  kiosk.lastConfigUpdate = new Date();
  await kiosk.save();
  return kiosk;
};

exports.deleteKiosk = async (ctx, kioskId, actor) => {
  const tenantId = requireTenant(ctx);
  const kiosk = await Kiosk.findOne({
    _id: kioskId,
    tenantId,
    isDeleted: false,
  });
  if (!kiosk)
    throw Object.assign(new Error("Kiosk not found"), { statusCode: 404 });
  kiosk.isDeleted = true;
  kiosk.deletedAt = new Date();
  kiosk.deletedBy = actor.userId;
  await kiosk.save();
  return { success: true };
};

exports.heartbeat = async (ctx, kioskId) => {
  const tenantId = requireTenant(ctx);
  const kiosk = await Kiosk.findOne({
    _id: kioskId,
    tenantId,
    isDeleted: false,
  });
  if (!kiosk)
    throw Object.assign(new Error("Kiosk not found"), { statusCode: 404 });
  kiosk.lastHeartbeat = new Date();
  kiosk.status = "online";
  await kiosk.save();
  return kiosk;
};

// ─── Wait Time Estimation ──────────────────────────────────────────────

exports.recordWaitTime = async (ctx, queueId, eventType, data) => {
  const tenantId = requireTenant(ctx);
  const queue = await WalkupQueue.findOne({
    _id: queueId,
    tenantId,
    isDeleted: false,
  });
  if (!queue) return;

  const event = await WaitTimeEvent.create({
    tenantId,
    queueId,
    checkinId: data.checkinId,
    queueSize: data.queueSize || 0,
    waitTimeMinutes: data.waitTimeMinutes || 0,
    servedCount: data.servedCount || 0,
    abandonedCount: data.abandonedCount || 0,
    avgServiceMinutes: data.avgServiceMinutes || 0,
    eventType,
  });

  // Update queue estimation
  await exports.updateQueueStats(queueId, tenantId);

  return event;
};

exports.getWaitTimeEstimate = async (ctx, queueId) => {
  const tenantId = requireTenant(ctx);
  const queue = await WalkupQueue.findOne({
    _id: queueId,
    tenantId,
    isDeleted: false,
  });
  if (!queue)
    throw Object.assign(new Error("Queue not found"), { statusCode: 404 });
  return {
    estimatedWaitMinutes: queue.estimatedWaitMinutes,
    avgWaitMinutes: queue.avgWaitMinutes,
    queueSize: queue.currentSize,
  };
};

// ─── Dashboard / Stats ─────────────────────────────────────────────────

exports.getDashboard = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const [
    locations,
    services,
    queues,
    checkins,
    appointments,
    kiosks,
    interactions,
  ] = await Promise.all([
    WalkupLocation.find({ tenantId, isDeleted: false }),
    WalkupService.find({ tenantId, isDeleted: false }),
    WalkupQueue.find({ tenantId, isDeleted: false }),
    WalkupCheckin.find({
      tenantId,
      status: { $in: ["waiting", "called", "in_service"] },
    }),
    Appointment.find({
      tenantId,
      isDeleted: false,
      status: { $in: ["scheduled", "confirmed", "checked_in"] },
    }),
    Kiosk.find({ tenantId, isDeleted: false }),
    WalkupInteraction.find({ tenantId }),
  ]);

  const activeCheckins = checkins.length;
  const waitingCount = checkins.filter((c) => c.status === "waiting").length;
  const inServiceCount = checkins.filter(
    (c) => c.status === "in_service",
  ).length;
  const upcomingAppointments = appointments.filter(
    (a) => new Date(a.scheduledAt) >= new Date(),
  ).length;
  const onlineKiosks = kiosks.filter((k) => k.status === "online").length;

  const avgWait = queues.length
    ? Math.round(
        queues.reduce((s, q) => s + (q.avgWaitMinutes || 0), 0) / queues.length,
      )
    : 0;

  return {
    totalLocations: locations.length,
    activeLocations: locations.filter((l) => l.status === "active").length,
    totalServices: services.length,
    activeServices: services.filter((s) => s.status === "active").length,
    totalQueues: queues.length,
    openQueues: queues.filter((q) => q.status === "open").length,
    activeCheckins,
    waitingCount,
    inServiceCount,
    upcomingAppointments,
    totalKiosks: kiosks.length,
    onlineKiosks,
    totalInteractions: interactions.length,
    avgWaitMinutes: avgWait,
  };
};

// ─── Queue Number Reset ────────────────────────────────────────────────

exports.resetQueueNumber = async (ctx, queueId) => {
  const tenantId = requireTenant(ctx);
  const queue = await WalkupQueue.findOne({
    _id: queueId,
    tenantId,
    isDeleted: false,
  });
  if (!queue)
    throw Object.assign(new Error("Queue not found"), { statusCode: 404 });
  queue.nextNumber = 1;
  await queue.save();
  return queue;
};

module.exports.pick = pick;
