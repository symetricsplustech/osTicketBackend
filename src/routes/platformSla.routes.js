const express = require('express');
const PlatformSlaPolicy = require('../models/PlatformSlaPolicy');
const SlaEvent = require('../models/SlaEvent');
const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requirePlatformPermission } = require('../middleware/auth');
const { P } = require('../config/platformPermissions');
const router = express.Router();

const audit = (req, action, policy, details = {}) => AuditLog.create({ superAdmin: req.superAdmin._id, action, entityType: 'PlatformSlaPolicy', entityId: String(policy._id), details: { name: policy.name, ...details }, ip: req.ip || '', userAgent: req.get('user-agent') || '' });

router.get('/policies', requirePlatformPermission(P.SLA_READ), asyncHandler(async (_req, res) => {
  const data = await PlatformSlaPolicy.find().populate('plans', 'name code').sort({ name: 1 });
  res.json({ success: true, data });
}));
router.post('/policies', requirePlatformPermission(P.SLA_MANAGE), asyncHandler(async (req, res) => {
  const policy = await PlatformSlaPolicy.create({ ...req.body, createdBy: req.superAdmin._id, updatedBy: req.superAdmin._id });
  await audit(req, 'platform_sla.policy_created', policy);
  res.status(201).json({ success: true, data: policy });
}));
router.put('/policies/:id', requirePlatformPermission(P.SLA_MANAGE), asyncHandler(async (req, res) => {
  const blocked = new Set(['_id', 'createdBy']);
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => !blocked.has(key)));
  changes.updatedBy = req.superAdmin._id;
  const policy = await PlatformSlaPolicy.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true, runValidators: true });
  if (!policy) throw new ApiError(404, 'Platform SLA policy not found');
  await audit(req, 'platform_sla.policy_updated', policy);
  res.json({ success: true, data: policy });
}));
router.delete('/policies/:id', requirePlatformPermission(P.SLA_MANAGE), asyncHandler(async (req, res) => {
  const policy = await PlatformSlaPolicy.findByIdAndUpdate(req.params.id, { $set: { status: 'disabled', updatedBy: req.superAdmin._id } }, { new: true });
  if (!policy) throw new ApiError(404, 'Platform SLA policy not found');
  await audit(req, 'platform_sla.policy_disabled', policy);
  res.json({ success: true, data: policy });
}));

router.post('/measurements', requirePlatformPermission(P.SLA_MEASURE), asyncHandler(async (req, res) => {
  const { policy, service, actual, target, unit, priority, startedAt, completedAt, metadata } = req.body;
  if (!policy || !service || !Number.isFinite(Number(actual)) || !Number.isFinite(Number(target))) throw new ApiError(422, 'policy, service, actual and target are required');
  const policyDoc = await PlatformSlaPolicy.findById(policy);
  if (!policyDoc) throw new ApiError(404, 'Platform SLA policy not found');
  const definition = policyDoc.targets.find((item) => item.service === service && (!priority || !item.priority || item.priority === priority));
  const comparison = definition?.comparison || (String(unit).includes('percent') ? 'gte' : 'lte');
  const breached = comparison === 'gte' ? Number(actual) < Number(target) : Number(actual) > Number(target);
  const event = await SlaEvent.create({ level: 'platform', policy, policyModel: 'PlatformSlaPolicy', service, event: breached ? 'breached' : 'measurement', priority: priority || '', actual: Number(actual), target: Number(target), unit: unit || '', startedAt, completedAt, durationMs: startedAt && completedAt ? new Date(completedAt) - new Date(startedAt) : null, metadata: metadata || {}, actorType: 'superadmin', actor: req.superAdmin._id });
  res.status(201).json({ success: true, data: event, breached });
}));

router.get('/dashboard', requirePlatformPermission(P.SLA_READ), asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - (Math.min(Number(req.query.days) || 30, 365) * 86400000));
  const [platform, tenantAgg, openPlatformIncidents, p1Incidents, openTickets, breachedTickets] = await Promise.all([
    SlaEvent.find({ level: 'platform', occurredAt: { $gte: since } }).lean(),
    SlaEvent.aggregate([{ $match: { level: 'tenant', occurredAt: { $gte: since }, event: { $in: ['met', 'breached'] } } }, { $group: { _id: '$company', total: { $sum: 1 }, met: { $sum: { $cond: [{ $eq: ['$event', 'met'] }, 1, 0] } }, breached: { $sum: { $cond: [{ $eq: ['$event', 'breached'] }, 1, 0] } } } }]),
    require('../models/PlatformResource').countDocuments({ kind: 'support_incident', status: { $in: ['active', 'open', 'investigating'] } }),
    require('../models/PlatformResource').countDocuments({ kind: 'support_incident', 'config.priority': { $in: ['P1', 'critical'] }, createdAt: { $gte: since } }),
    Ticket.countDocuments({ status: { $nin: ['resolved', 'closed', 'archived', 'deleted'] } }),
    Ticket.countDocuments({ $or: [{ isOverdue: true }, { responseBreached: true }], createdAt: { $gte: since } }),
  ]);
  const byService = {};
  for (const event of platform) {
    const bucket = byService[event.service] ||= { measurements: 0, breaches: 0, totalActual: 0 };
    bucket.measurements += 1; bucket.totalActual += Number(event.actual || 0); if (event.event === 'breached') bucket.breaches += 1;
  }
  for (const bucket of Object.values(byService)) { bucket.average = bucket.measurements ? bucket.totalActual / bucket.measurements : null; bucket.compliance = bucket.measurements ? ((bucket.measurements - bucket.breaches) / bucket.measurements) * 100 : null; }
  const tenantsWithin = tenantAgg.filter((row) => row.breached === 0).length;
  res.json({ success: true, data: { periodDays: Math.min(Number(req.query.days) || 30, 365), services: byService, tenantsMeasured: tenantAgg.length, tenantsWithinSlaPct: tenantAgg.length ? (tenantsWithin / tenantAgg.length) * 100 : 100, tenantCompliance: tenantAgg, openPlatformIncidents, p1Incidents, openTickets, breachedTickets, activeTenants: await Company.countDocuments({ status: 'active' }) } });
}));

module.exports = router;
