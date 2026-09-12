/**
 * Outage / Service Availability Management service — unified engine for
 * outage lifecycle, CI/service associations, timeline, communication, and availability tracking.
 */
const mongoose = require('mongoose');
const numberingService = require('./numbering.service');
const auditEventService = require('./auditEventService');
const { emitEvent } = require('../realtime/socketManager');

const requireTenant = (ctx) => { if (!ctx.tenantId) throw Object.assign(new Error('Tenant context required'), { statusCode: 400 }); return ctx.tenantId; };
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));

const Outage = mongoose.model('Outage');
const OutageCI = mongoose.model('OutageCI');
const OutageService = mongoose.model('OutageService');
const AvailabilityRecord = mongoose.model('AvailabilityRecord');
const ConfigurationItem = mongoose.model('ConfigurationItem');
const BusinessService = mongoose.model('BusinessService');
const Incident = mongoose.model('Incident');
const Change = mongoose.model('Change');
const StatusPage = mongoose.model('StatusPage');
const StatusIncident = mongoose.model('StatusIncident');

// ─── State Machine ─────────────────────────────────────────────────────

const OUTAGE_TRANSITIONS = {
  investigating: ['identified', 'canceled'],
  identified: ['monitoring', 'investigating', 'canceled'],
  monitoring: ['resolved', 'identified', 'canceled'],
  resolved: ['closed', 'monitoring'],
  closed: [],
  canceled: [],
};

// ─── Outage CRUD ──────────────────────────────────────────────────────

exports.listOutages = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['status', 'severity', 'type', 'ownerId']) };
  if (query.search) filter.$or = [{ title: { $regex: query.search, $options: 'i' } }, { description: { $regex: query.search, $options: 'i' } }];
  if (query.from) filter.startTime = { $gte: new Date(query.from) };
  if (query.to) filter.startTime = { ...filter.startTime, $lte: new Date(query.to) };
  return Outage.find(filter).sort({ startTime: -1 });
};

exports.getOutage = async (ctx, outageId) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw Object.assign(new Error('Outage not found'), { statusCode: 404 });
  return outage;
};

exports.getOutageWithDetails = async (ctx, outageId) => {
  const tenantId = requireTenant(ctx);
  const [outage, cis, services, timeline] = await Promise.all([
    Outage.findOne({ _id: outageId, tenantId, isDeleted: false }),
    OutageCI.find({ tenantId, outageId: outageId }).populate('ciId', 'name ciClass criticality status environment'),
    OutageService.find({ tenantId, outageId: outageId }).populate('serviceId', 'name category criticality').populate('technicalServiceId', 'name type environment'),
    Outage.findOne({ _id: outageId, tenantId, isDeleted: false }).select('timeline'),
  ]);
  if (!outage) throw Object.assign(new Error('Outage not found'), { statusCode: 404 });
  return { ...outage.toObject(), cis, services, timeline: outage.timeline || [] };
};

exports.createOutage = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'OUT');
  const outage = await Outage.create({
    ...data,
    tenantId,
    number,
    ownerId: data.ownerId || actor.userId,
    detectedBy: actor.userId,
    createdBy: actor.userId,
    timeline: [{
      status: 'investigating',
      message: 'Outage created',
      authorId: actor.userId,
    }],
  });
  await auditEventService.log({ tenantId, actorId: actor.userId, action: 'outage.create', entityType: 'Outage', entityId: outage._id });
  emitEvent(tenantId, 'outage.created', { outageId: outage._id, number: outage.number });
  return outage;
};

exports.updateOutage = async (ctx, outageId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw Object.assign(new Error('Outage not found'), { statusCode: 404 });
  const allowed = ['title', 'description', 'type', 'severity', 'impact', 'rootCause', 'estimatedRestoration', 'plannedStart', 'plannedEnd', 'ownerId', 'communicationPlan', 'metadata'];
  Object.assign(outage, pick(data, allowed));
  await outage.save();
  return outage;
};

exports.transitionOutage = async (ctx, outageId, targetStatus, actor) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw Object.assign(new Error('Outage not found'), { statusCode: 404 });
  const allowed = OUTAGE_TRANSITIONS[outage.status] || [];
  if (!allowed.includes(targetStatus)) throw Object.assign(new Error(`Invalid transition from ${outage.status} to ${targetStatus}`), { statusCode: 422 });
  const oldStatus = outage.status;
  outage.status = targetStatus;
  if (targetStatus === 'resolved' && !outage.actualRestoration) outage.actualRestoration = new Date();
  if (targetStatus === 'closed' && !outage.actualRestoration) outage.actualRestoration = new Date();
  outage.timeline.push({ status: targetStatus, message: `Status changed to ${targetStatus}`, authorId: actor.userId });
  await outage.save();
  await auditEventService.log({ tenantId, actorId: actor.userId, action: 'outage.transition', entityType: 'Outage', entityId: outageId, before: { status: oldStatus }, after: { status: targetStatus } });
  emitEvent(tenantId, 'outage.statusChanged', { outageId, oldStatus, newStatus: targetStatus });
  return outage;
};

exports.deleteOutage = async (ctx, outageId, actor) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw Object.assign(new Error('Outage not found'), { statusCode: 404 });
  outage.isDeleted = true; outage.deletedAt = new Date(); outage.deletedBy = actor.userId;
  await outage.save();
  return { success: true };
};

// ─── CI Associations ──────────────────────────────────────────────────

exports.listOutageCIs = async (ctx, outageId) => {
  const tenantId = requireTenant(ctx);
  return OutageCI.find({ tenantId, outageId }).populate('ciId', 'name ciClass criticality status environment');
};

exports.addOutageCI = async (ctx, outageId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const existing = await OutageCI.findOne({ tenantId, outageId, ciId: data.ciId });
  if (existing) {
    Object.assign(existing, pick(data, ['role', 'impact', 'notes']));
    await existing.save();
    return existing;
  }
  return OutageCI.create({ ...data, tenantId, outageId, addedBy: actor.userId });
};

exports.removeOutageCI = async (ctx, outageId, ciId) => {
  const tenantId = requireTenant(ctx);
  return OutageCI.findOneAndUpdate({ tenantId, outageId, ciId }, { removedAt: new Date(), removedBy: actor?.userId });
};

exports.updateOutageCI = async (ctx, outageId, ciId, data) => {
  const tenantId = requireTenant(ctx);
  return OutageCI.findOneAndUpdate({ tenantId, outageId, ciId }, { $set: data }, { new: true });
};

// ─── Service Associations ─────────────────────────────────────────────

exports.listOutageServices = async (ctx, outageId) => {
  const tenantId = requireTenant(ctx);
  return OutageService.find({ tenantId, outageId }).populate('serviceId', 'name category criticality').populate('technicalServiceId', 'name type environment');
};

exports.addOutageService = async (ctx, outageId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const existing = await OutageService.findOne({ tenantId, outageId, serviceId: data.serviceId });
  if (existing) {
    Object.assign(existing, pick(data, ['role', 'impact', 'notes']));
    await existing.save();
    return existing;
  }
  return OutageService.create({ ...data, tenantId, outageId, addedBy: actor.userId });
};

exports.updateOutageService = async (ctx, outageId, serviceId, data) => {
  const tenantId = requireTenant(ctx);
  return OutageService.findOneAndUpdate({ tenantId, outageId, serviceId }, { $set: data }, { new: true });
};

exports.removeOutageService = async (ctx, outageId, serviceId) => {
  const tenantId = requireTenant(ctx);
  return OutageService.findOneAndDelete({ tenantId, outageId, serviceId });
};

// ─── Timeline ────────────────────────────────────────────────────────

exports.addTimelineEntry = async (ctx, outageId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw Object.assign(new Error('Outage not found'), { statusCode: 404 });
  const entry = {
    status: data.status || outage.status,
    message: data.message,
    authorId: actor.userId,
  };
  outage.timeline.push(entry);
  if (data.status && data.status !== outage.status) {
    outage.status = data.status;
  }
  outage.lastCommunicationAt = new Date();
  await outage.save();
  emitEvent(tenantId, 'outage.timeline.added', { outageId, entry });
  return outage;
};

exports.getTimeline = async (ctx, outageId) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false }).select('timeline');
  if (!outage) throw Object.assign(new Error('Outage not found'), { statusCode: 404 });
  return outage.timeline;
};

// ─── Communication ───────────────────────────────────────────────────

exports.updateCommunicationPlan = async (ctx, outageId, data) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw Object.assign(new Error('Outage not found'), { statusCode: 404 });
  Object.assign(outage.communicationPlan, data);
  await outage.save();
  return outage;
};

exports.recordCommunication = async (ctx, outageId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw Object.assign(new Error('Outage not found'), { statusCode: 404 });
  outage.lastCommunicationAt = new Date();
  outage.nextCommunicationAt = data.nextAt || new Date(Date.now() + 30 * 60000);
  outage.timeline.push({ status: outage.status, message: data.message, authorId: actor.userId });
  await outage.save();
  return outage;
};

// ─── Related Incidents/Changes ────────────────────────────────────────

exports.associateIncident = async (ctx, outageId, incidentId) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw Object.assign(new Error('Outage not found'), { statusCode: 404 });
  const incident = await Incident.findOne({ _id: incidentId, tenantId });
  if (!incident) throw Object.assign(new Error('Incident not found'), { statusCode: 404 });
  // In production: add to outage.incidents array or many-to-many
  return { success: true };
};

exports.associateChange = async (ctx, outageId, changeId) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw Object.assign(new Error('Outage not found'), { statusCode: 404 });
  const change = await Change.findOne({ _id: changeId, tenantId });
  if (!change) throw Object.assign(new Error('Change not found'), { statusCode: 404 });
  // In production: add to outage.changes array or many-to-many
  return { success: true };
};

// ─── Availability Calculation ────────────────────────────────────────

exports.calculateAvailability = async (ctx, entityType, entityId, periodStart, periodEnd) => {
  const tenantId = requireTenant(ctx);
  const outages = await Outage.find({
    tenantId,
    startTime: { $lt: periodEnd, $gte: periodStart },
    isDeleted: false,
  });

  const totalMinutes = (periodEnd - periodStart) / 60000;
  const downtimeMinutes = outages.reduce((sum, o) => {
    const start = Math.max(o.startTime, periodStart);
    const end = o.actualRestoration ? Math.min(o.actualRestoration, periodEnd) : periodEnd;
    return sum + Math.max(0, (end - start) / 60000);
  }, 0);
  const uptimeMinutes = Math.max(0, totalMinutes - downtimeMinutes);
  const availability = totalMinutes > 0 ? (uptimeMinutes / totalMinutes) * 100 : 100;

  return AvailabilityRecord.create({
    tenantId,
    entityType,
    entityId,
    periodStart,
    periodEnd,
    granularity: 'hourly',
    totalMinutes: Math.round(totalMinutes),
    uptimeMinutes: Math.round(uptimeMinutes),
    downtimeMinutes: Math.round(downtimeMinutes),
    availabilityPercentage: Math.round(availability * 100) / 100,
    outageCount: outages.length,
  });
};

exports.getAvailabilityRecords = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, ...pick(query, ['entityType', 'entityId', 'granularity']) };
  if (query.from) filter.periodStart = { $gte: new Date(query.from) };
  if (query.to) filter.periodEnd = { ...filter.periodEnd, $lte: new Date(query.to) };
  return AvailabilityRecord.find(filter).sort({ periodStart: -1 }).limit(parseInt(query.limit) || 100);
};

exports.getServiceAvailability = async (ctx, serviceId, periodStart, periodEnd) => {
  const tenantId = requireTenant(ctx);
  const records = await AvailabilityRecord.find({
    tenantId,
    entityType: 'business_service',
    entityId: serviceId,
    periodStart: { $gte: periodStart, $lte: periodEnd },
  }).sort({ periodStart: 1 });

  if (!records.length) return { availability: 100, records: [] };

  const totalUptime = records.reduce((s, r) => s + r.uptimeMinutes, 0);
  const totalDowntime = records.reduce((s, r) => s + r.downtimeMinutes, 0);
  const totalMinutes = totalUptime + totalDowntime;
  const availability = totalMinutes > 0 ? (totalUptime / totalMinutes) * 100 : 100;

  return { availability: Math.round(availability * 100) / 100, records };
};

// ─── Dashboard / Stats ───────────────────────────────────────────────

exports.getDashboard = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const [outages, cis, services, records] = await Promise.all([
    Outage.find({ tenantId, isDeleted: false }),
    OutageCI.find({ tenantId }),
    OutageService.find({ tenantId }),
    AvailabilityRecord.find({ tenantId }).sort({ periodStart: -1 }).limit(50),
  ]);

  const statusBreakdown = {};
  for (const o of outages) statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1;
  const severityBreakdown = {};
  for (const o of outages) severityBreakdown[o.severity] = (severityBreakdown[o.severity] || 0) + 1;
  const typeBreakdown = {};
  for (const o of outages) typeBreakdown[o.type] = (typeBreakdown[o.type] || 0) + 1;

  const activeOutages = outages.filter(o => ['investigating', 'identified', 'monitoring'].includes(o.status)).length;
  const resolvedToday = outages.filter(o => o.status === 'resolved' && o.actualRestoration && o.actualRestoration >= new Date(new Date().setHours(0,0,0,0))).length;

  const latestRecords = records.slice(0, 10);
  const avgAvailability = records.length ? records.reduce((s, r) => s + r.availabilityPercentage, 0) / records.length : 100;

  return {
    totalOutages: outages.length,
    activeOutages,
    resolvedToday,
    statusBreakdown,
    severityBreakdown,
    typeBreakdown,
    totalCIsAffected: cis.length,
    totalServicesAffected: services.length,
    avgAvailability: Math.round(avgAvailability * 100) / 100,
    recentRecords: latestRecords,
  };
};

// ─── Communication Cadence Job ───────────────────────────────────────

exports.processCommunicationCadence = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const now = new Date();
  const activeOutages = await Outage.find({ tenantId, status: { $in: ['investigating', 'identified', 'monitoring'] }, isDeleted: false });

  for (const outage of activeOutages) {
    const plan = outage.communicationPlan;
    if (!plan.internal.enabled || !outage.nextCommunicationAt || outage.nextCommunicationAt > now) continue;
    
    // In production: send notifications via notification service
    outage.lastCommunicationAt = now;
    outage.nextCommunicationAt = new Date(now.getTime() + plan.internal.cadenceMinutes * 60000);
    await outage.save();
    
    emitEvent(tenantId, 'outage.communication.sent', { outageId: outage._id, audience: 'internal' });
  }
};

module.exports.OUTAGE_TRANSITIONS = OUTAGE_TRANSITIONS;
module.exports.pick = pick;
