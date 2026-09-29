/**
 * Outage / Service Availability Management service — unified engine for
 * outage lifecycle, CI/service associations, timeline, communication, and availability tracking.
 */
const numberingService = require('./numbering.service');
const auditEventService = require('./auditEventService');
const { emitEvent } = require('../realtime/socketManager');

const Outage = require('../models/outage/Outage');
const OutageCI = require('../models/outage/OutageCI');
const OutageService = require('../models/outage/OutageService');
const OutageRelation = require('../models/outage/OutageRelation');
const ApiError = require('../utils/ApiError');
const AvailabilityRecord = require('../models/outage/AvailabilityRecord');
const ConfigurationItem = require('../models/cmdb/ConfigurationItem');
const BusinessService = require('../models/cmdb/BusinessService');
const Incident = require('../models/helpdesk/incidents/Incident');
const Change = require('../models/helpdesk/incidents/Change');
const StatusPage = require('../models/StatusPage');
const StatusIncident = require('../models/StatusIncident');

const requireTenant = (ctx) => { if (!ctx.tenantId) throw new ApiError(400, 'Tenant context required'); return ctx.tenantId; };

// Without these a missing field reaches PostgreSQL as a not-null violation and
// surfaces as a 500, so the request is rejected before the insert.
const fail = (statusCode, message) => { throw new ApiError(statusCode, message); };
const requireField = (value, field) => { if (value === undefined || value === null || value === '') fail(422, `${field} is required`); return value; };
const requireId = (value, field) => {
  requireField(value, field);
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail(422, `A valid ${field} is required`);
  return value;
};
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));

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
  // The dashboard already treats investigating/identified/monitoring as "active",
  // but the list only accepted a single status, so the Active Outages screen
  // could not be expressed. A comma separated value maps onto the same $in.
  if (typeof query.status === 'string' && query.status.includes(',')) {
    const statuses = query.status.split(',').map((v) => v.trim()).filter(Boolean);
    if (statuses.length) filter.status = { $in: statuses };
  }
  if (query.search) filter.$or = [{ title: { $regex: query.search, $options: 'i' } }, { description: { $regex: query.search, $options: 'i' } }];
  if (query.from) filter.startTime = { $gte: new Date(query.from) };
  if (query.to) filter.startTime = { ...filter.startTime, $lte: new Date(query.to) };
  return Outage.find(filter).sort({ startTime: -1 });
};

exports.getOutage = async (ctx, outageId) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw new ApiError(404, 'Outage not found');
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
  if (!outage) throw new ApiError(404, 'Outage not found');
  return { ...outage.toObject(), cis, services, timeline: outage.timeline || [] };
};

exports.createOutage = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  requireField(data.title, 'title');
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
  if (!outage) throw new ApiError(404, 'Outage not found');
  const allowed = ['title', 'description', 'type', 'severity', 'impact', 'rootCause', 'estimatedRestoration', 'plannedStart', 'plannedEnd', 'ownerId', 'communicationPlan', 'metadata'];
  Object.assign(outage, pick(data, allowed));
  await outage.save();
  return outage;
};

exports.transitionOutage = async (ctx, outageId, targetStatus, actor) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw new ApiError(404, 'Outage not found');
  const allowed = OUTAGE_TRANSITIONS[outage.status] || [];
  if (!allowed.includes(targetStatus)) fail(422, `Invalid transition from ${outage.status} to ${targetStatus}`);
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
  if (!outage) throw new ApiError(404, 'Outage not found');
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
  requireId(data.ciId, 'ciId');
  const existing = await OutageCI.findOne({ tenantId, outageId, ciId: data.ciId });
  if (existing) {
    Object.assign(existing, pick(data, ['role', 'impact', 'notes']));
    await existing.save();
    return existing;
  }
  return OutageCI.create({ ...data, tenantId, outageId, addedBy: actor.userId });
};

exports.removeOutageCI = async (ctx, outageId, ciId, actor) => {
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
  requireId(data.serviceId, 'serviceId');
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
  if (!outage) throw new ApiError(404, 'Outage not found');
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
  if (!outage) throw new ApiError(404, 'Outage not found');
  return outage.timeline;
};

// ─── Communication ───────────────────────────────────────────────────

exports.updateCommunicationPlan = async (ctx, outageId, data) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw new ApiError(404, 'Outage not found');
  Object.assign(outage.communicationPlan, data);
  await outage.save();
  return outage;
};

exports.recordCommunication = async (ctx, outageId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw new ApiError(404, 'Outage not found');
  outage.lastCommunicationAt = new Date();
  outage.nextCommunicationAt = data.nextAt || new Date(Date.now() + 30 * 60000);
  outage.timeline.push({ status: outage.status, message: data.message, authorId: actor.userId });
  await outage.save();
  return outage;
};

// ─── Related Incidents/Changes ────────────────────────────────────────

// ─── Related Incidents/Changes (16.3) ────────────────────────────────────
//
// The outage_* tables are tenant scoped by tenant_id, but incidents and
// change_requests are scoped by company_id, so each target is resolved with the
// column its own table actually has. The link is stored in outage_relations
// (see migrations/20260928000011_phase16_outage_relations.js); re-linking a
// target that is already attached updates the existing row instead of failing
// the unique index, and removing a link soft-deletes it so the history survives.

const RELATION_TARGETS = {
  incident: { model: () => Incident, entity: 'Incident' },
  change: { model: () => Change, entity: 'Change' },
  major_incident: { model: () => Incident, entity: 'Incident' },
};

const linkRelation = async (ctx, outageId, relationType, targetId, data = {}, actor) => {
  const tenantId = requireTenant(ctx);
  const target = RELATION_TARGETS[relationType];
  if (!target) fail(422, `Unknown relation type ${relationType}`);

  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw new ApiError(404, 'Outage not found');
  requireId(targetId, `${relationType}Id`);

  // Scope by the target table's own tenancy column (company_id), not the
  // outage's tenant_id, otherwise the lookup can never match.
  const record = await target.model().findOne({ _id: targetId, companyId: tenantId });
  if (!record) fail(404, `${target.entity} not found`);

  const existing = await OutageRelation.findOne({ tenantId, outageId, relationType, targetId, removedAt: null });
  if (existing) {
    Object.assign(existing, pick(data, ['role', 'impact', 'notes']));
    await existing.save();
    return existing;
  }
  return OutageRelation.create({
    tenantId,
    outageId,
    relationType,
    targetId,
    title: record.title || record.name || null,
    number: record.number || null,
    role: data.role || null,
    impact: data.impact || null,
    notes: data.notes || null,
    addedBy: actor?.userId ?? null,
  });
};

exports.associateIncident = async (ctx, outageId, incidentId, data, actor) =>
  linkRelation(ctx, outageId, 'incident', incidentId, data, actor);

exports.associateMajorIncident = async (ctx, outageId, incidentId, data, actor) =>
  linkRelation(ctx, outageId, 'major_incident', incidentId, data, actor);

exports.associateChange = async (ctx, outageId, changeId, data, actor) =>
  linkRelation(ctx, outageId, 'change', changeId, data, actor);

exports.listRelations = async (ctx, outageId, query = {}) => {
  const tenantId = requireTenant(ctx);
  const outage = await Outage.findOne({ _id: outageId, tenantId, isDeleted: false });
  if (!outage) throw new ApiError(404, 'Outage not found');
  const filter = { tenantId, outageId, removedAt: null, ...(query.relationType ? { relationType: query.relationType } : {}) };
  return OutageRelation.find(filter).sort({ createdAt: -1 });
};

exports.removeRelation = async (ctx, outageId, relationId, actor) => {
  const tenantId = requireTenant(ctx);
  const relation = await OutageRelation.findOne({ _id: relationId, tenantId, outageId, removedAt: null });
  if (!relation) throw new ApiError(404, 'Relationship not found');
  relation.removedAt = new Date();
  relation.removedBy = actor?.userId ?? null;
  await relation.save();
  return relation;
};

// ─── Availability Calculation ────────────────────────────────────────

exports.calculateAvailability = async (ctx, entityType, entityId, periodStart, periodEnd) => {
  const tenantId = requireTenant(ctx);
  requireField(entityType, 'entityType');
  requireId(entityId, 'entityId');
  const periodFrom = periodStart ? new Date(periodStart) : null;
  const periodTo = periodEnd ? new Date(periodEnd) : null;
  if (!periodFrom || Number.isNaN(periodFrom.getTime())) fail(422, 'A valid periodStart is required');
  if (!periodTo || Number.isNaN(periodTo.getTime())) fail(422, 'A valid periodEnd is required');
  if (periodTo <= periodFrom) fail(422, 'periodEnd must be after periodStart');
  const outages = await Outage.find({
    tenantId,
    startTime: { $lt: periodTo, $gte: periodFrom },
    isDeleted: false,
  });

  // The validated Dates are used throughout, so a string period from the query
  // string cannot leak into the arithmetic and produce NaN.
  const totalMinutes = (periodTo - periodFrom) / 60000;
  const downtimeMinutes = outages.reduce((sum, o) => {
    const from = Math.max(new Date(o.startTime), periodFrom);
    const to = Math.min(o.actualRestoration ? new Date(o.actualRestoration) : periodTo, periodTo);
    return sum + Math.max(0, (to - from) / 60000);
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
    // A plan is free-form jsonb, so `internal` is not guaranteed to be present;
    // reading plan.internal.enabled unguarded threw on any partially filled plan.
    const plan = outage.communicationPlan;
    const internal = plan?.internal;
    if (!internal?.enabled || !outage.nextCommunicationAt || outage.nextCommunicationAt > now) continue;
    
    // In production: send notifications via notification service
    outage.lastCommunicationAt = now;
    outage.nextCommunicationAt = new Date(now.getTime() + (internal.cadenceMinutes || 60) * 60000);
    await outage.save();
    
    emitEvent(tenantId, 'outage.communication.sent', { outageId: outage._id, audience: 'internal' });
  }
};

module.exports.OUTAGE_TRANSITIONS = OUTAGE_TRANSITIONS;
module.exports.pick = pick;
