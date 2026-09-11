const express = require('express');
const { protectTenantPrincipal } = require('../middleware/auth');
const { moduleRequired } = require('../middleware/module');
const { authorize, isAggregateAdmin, grantedScopes } = require('../services/authorization.service');
const { auditRequired } = require('../services/audit.service');
const { authorizeAgentCommand, auditAgentCommand } = require('../services/securedCommand.service');
const ApiError = require('../utils/ApiError');
const E = require('../models/enterprise');
const P5 = require('../models/platformServices');
const P6 = require('../models/platformData');
const ServiceCatalogItem = require('../models/ServiceCatalogItem');
const ServiceRequest = require('../models/helpdesk/incidents/ServiceRequest');
const RequestedItem = require('../models/domain').RequestedItem;
const User = require('../models/User');

const router = express.Router();
router.use(protectTenantPrincipal);
const T = req => ({ tenantId: req.user.tenantId || req.user.companyId });
const workflowTenant = req => ({ company: T(req).tenantId });
const workflowGuard = (permission) => [
  moduleRequired('helpdesk'),
  async (req, _res, next) => {
    try {
      if (!req.agent) throw new ApiError(403, 'Agent access required');
      await authorizeAgentCommand({ req, permission, resource: { type: 'workflow' } });
      next();
    } catch (error) { next(error); }
  },
];

// ============ LEGACY COMPAT LAYER (/enterprise/* core endpoints) ============
const def = p => { const m = require(p); return typeof m === 'function' ? m : (m[Object.keys(m).find(k => typeof m[k] === 'function' && k[0] !== '_')] || m[Object.keys(m)[0]]); };
const Inc = def('../models/helpdesk/incidents/Incident'), Chg = def('../models/helpdesk/incidents/Change'), Prb = def('../models/helpdesk/incidents/Problem'),
      Wkf = def('../models/Workflow'), Ast = def('../models/Asset');

router.get('/workflows', ...workflowGuard('workflow.manage'), async (req, res) => {
  try { res.json({ workflows: await Wkf.find(workflowTenant(req)).sort({ createdAt: -1 }) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/workflows/:id', ...workflowGuard('workflow.manage'), async (req, res) => {
  try { res.json({ workflow: await Wkf.findOne({ _id: req.params.id, ...workflowTenant(req) }) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/workflows', ...workflowGuard('workflow.manage'), async (req, res) => {
  try { const wf = await Wkf.create({ name: req.body.name, description: req.body.description, event: req.body.event || req.body.trigger || 'ticket_created', conditions: req.body.conditions || [], actions: req.body.actions || [], isActive: false, status: 'draft', isDraft: true, company: T(req).tenantId });
    await auditRequired({ company: T(req).tenantId, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'workflow.created', entityType: 'workflow', entityId: wf._id, after: { name: wf.name, event: wf.event, isActive: wf.isActive }, req });
    res.json({ workflow: wf }); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/workflows/:id', ...workflowGuard('workflow.manage'), async (req, res) => {
  try {
    const before = await Wkf.findOne({ _id: req.params.id, ...workflowTenant(req) });
    if (!before) return res.status(404).json({});
    const body = {}; for (const key of ['name', 'description', 'event', 'conditions', 'actions', 'isActive', 'triggerFilters']) if (req.body[key] !== undefined) body[key] = req.body[key];
    const wf = await Wkf.findOneAndUpdate({ _id: req.params.id, ...workflowTenant(req) }, body, { new: true, runValidators: true });
    await auditRequired({ company: T(req).tenantId, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'workflow.updated', entityType: 'workflow', entityId: wf._id, before: { name: before.name, event: before.event, isActive: before.isActive }, after: { name: wf.name, event: wf.event, isActive: wf.isActive }, req });
    res.json({ workflow: wf });
  } catch (e) { res.status(e.statusCode || 400).json({ error: e.message }); }
});
router.delete('/workflows/:id', ...workflowGuard('workflow.manage'), async (req, res) => {
  try { const wf = await Wkf.findOne({ _id: req.params.id, ...workflowTenant(req) }); if (!wf) return res.status(404).json({}); await auditRequired({ company: T(req).tenantId, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'workflow.deleted', entityType: 'workflow', entityId: wf._id, before: { name: wf.name, event: wf.event, isActive: wf.isActive }, req }); await wf.deleteOne(); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ITSM records are tenant-isolated via `company` (the canonical tenant key on
// these models) with atomic per-tenant numbering (MD §68) and state-machine
// guarded status writes (MD §65). Never mass-assign req.body.
const companyOf = (req) => ({ company: T(req).tenantId });
const { nextNumber } = require('../services/numbering.service');
const { findTenantRecord, transitionRecord, findChangeConflicts, scoreChangeRisk } = require('../services/taskCore.service');
const BlackoutWindow = require('../models/platformData/BlackoutWindow');
const SEVERITY_MAP = { critical: 'Sev1', high: 'Sev2', medium: 'Sev3', low: 'Sev4', Sev1: 'Sev1', Sev2: 'Sev2', Sev3: 'Sev3', Sev4: 'Sev4' };
const pick = (src, keys) => { const out = {}; for (const k of keys) if (src[k] !== undefined) out[k] = src[k]; return out; };
const coreItesmGuard = (permission) => [
  moduleRequired('helpdesk'),
  async (req, _res, next) => {
    try {
      if (!req.agent) throw new ApiError(403, 'Agent access required');
      await authorizeAgentCommand({ req, permission, resource: { type: 'itsm_core_record' } });
      next();
    } catch (error) { next(error); }
  },
];
const requireTenantScope = (req, _res, next) => {
  if (isAggregateAdmin(req.agent) || grantedScopes(req.agent).includes('TENANT')) return next();
  next(new ApiError(403, 'Tenant-wide record scope required'));
};
const assertCoreRecordAccess = async (req, permission, record) => {
  const result = await authorize({ principal: req.agent, permission, tenant: T(req).tenantId, resource: { type: 'itsm_core_record', id: record._id }, record, req });
  if (result.decision !== 'ALLOW') throw new ApiError(403, 'You do not have permission for this action');
};
const auditCoreRecord = (req, action, record, before = null, after = null) => auditAgentCommand({ req, action, entityType: record.constructor.modelName.toLowerCase(), entityId: record._id, before, after });
const incidentSeverity = (body) => {
  const supplied = body.severity ?? body.priority;
  if (supplied === undefined || supplied === null || supplied === '') return 'Sev3';
  const severity = SEVERITY_MAP[supplied];
  if (!severity) throw new ApiError(422, 'Invalid incident severity');
  return severity;
};
const CHANGE_TYPES = new Set(['standard', 'normal', 'emergency']);
const CHANGE_RISKS = new Set(['low', 'medium', 'high', 'critical']);
const changeInput = (body, { creating = false } = {}) => {
  const title = String(body.title || '').trim();
  if (creating && !title) throw new ApiError(422, 'Change title is required');
  if (body.type !== undefined && !CHANGE_TYPES.has(body.type)) throw new ApiError(422, 'Invalid change type');
  if ((body.risk !== undefined || body.riskLevel !== undefined) && !CHANGE_RISKS.has(body.risk || body.riskLevel)) throw new ApiError(422, 'Invalid change risk');
  const windowStart = body.windowStart ? new Date(body.windowStart) : null;
  const windowEnd = body.windowEnd ? new Date(body.windowEnd) : null;
  if ((body.windowStart && Number.isNaN(windowStart.getTime())) || (body.windowEnd && Number.isNaN(windowEnd.getTime()))) throw new ApiError(422, 'Invalid change window');
  if (windowStart && windowEnd && windowStart >= windowEnd) throw new ApiError(422, 'Change window end must be after its start');
};
const requiredEvidence = (value, label) => {
  if (!String(value || '').trim()) throw new ApiError(422, `${label} is required`);
};

router.get('/incidents', ...coreItesmGuard('records.view'), requireTenantScope, async (req, res) => {
  try { res.json({ incidents: await Inc.find(companyOf(req)).sort({ createdAt: -1 }).limit(300) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/incidents', ...coreItesmGuard('records.create'), async (req, res) => {
  try {
    if (!String(req.body.title || '').trim()) throw new ApiError(422, 'Incident title is required');
    if (req.body.isMajor) throw new ApiError(422, 'Declare a major incident through the dedicated declaration action');
    const inc = await Inc.create({
      number: await nextNumber(T(req).tenantId, 'INC'),
      title: String(req.body.title).trim(),
      description: req.body.description,
      severity: incidentSeverity(req.body),
      status: 'investigating',
      isMajor: false,
      commander: req.agent._id,
      createdBy: req.agent._id,
      timeline: [{ at: new Date(), by: req.agent.name || '', message: 'Incident created' }],
      ...companyOf(req),
    });
    await auditCoreRecord(req, 'incident.created', inc, null, { number: inc.number, title: inc.title, severity: inc.severity, status: inc.status });
    res.json({ incident: inc });
  } catch (e) { res.status(e.statusCode || 400).json({ error: e.message }); }
});
// Major-incident swarming callout (MD §82 / ITIL swarming): notify the
// incident's team with a callout message and log it to the incident timeline.
router.post('/incidents/:id/swarm', ...coreItesmGuard('records.update'), async (req, res, next) => {
  try {
    const incident = await findTenantRecord(Inc, req.params.id, T(req).tenantId, 'Incident');
    await assertCoreRecordAccess(req, 'records.update', incident);
    const { escalateToSwarm } = require('../services/swarm.service');
    const result = await escalateToSwarm({
      company: T(req).tenantId,
      incidentId: req.params.id,
      requesterId: req.user.id || req.user._id,
      message: req.body.message || '',
    });
    await auditCoreRecord(req, 'incident.swarm_requested', incident, null, { message: req.body.message || '' });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/incidents/:id/major', ...coreItesmGuard('records.update'), async (req, res) => {
  try {
    const incident = await findTenantRecord(Inc, req.params.id, T(req).tenantId, 'Incident');
    await assertCoreRecordAccess(req, 'records.update', incident);
    const isMajor = req.body.isMajor !== false;
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5) throw new ApiError(422, 'A major-incident declaration reason is required');
    if (isMajor && !['Sev1', 'Sev2'].includes(incident.severity)) throw new ApiError(422, 'Only Sev1 or Sev2 incidents may be declared major');
    const before = { isMajor: incident.isMajor, severity: incident.severity };
    incident.isMajor = isMajor;
    incident.timeline.push({ at: new Date(), by: req.agent.name, message: isMajor ? `Major incident declared: ${reason}` : `Major incident demoted: ${reason}` });
    await incident.save();
    await auditCoreRecord(req, isMajor ? 'incident.major_declared' : 'incident.major_demoted', incident, before, { isMajor: incident.isMajor, reason });
    res.json({ incident });
  } catch (e) { res.status(e.statusCode || 400).json({ error: e.message }); }
});
router.put('/incidents/:id/communication-plan', ...coreItesmGuard('records.update'), async (req, res) => {
  try {
    const incident = await findTenantRecord(Inc, req.params.id, T(req).tenantId, 'Incident');
    await assertCoreRecordAccess(req, 'records.update', incident);
    if (!incident.isMajor) throw new ApiError(422, 'A communication plan requires a declared major incident');
    const cadenceMinutes = Number(req.body.cadenceMinutes);
    if (!Number.isInteger(cadenceMinutes) || cadenceMinutes < 15 || cadenceMinutes > 1440) throw new ApiError(422, 'Communication cadence must be between 15 and 1440 minutes');
    const audience = [...new Set(req.body.audience || [])];
    if (!audience.length || audience.some((value) => !['internal', 'customer', 'public'].includes(value))) throw new ApiError(422, 'At least one valid communication audience is required');
    const plan = await P6.CommunicationPlan.findOneAndUpdate(
      { tenantId: T(req).tenantId, incident: incident._id },
      { cadenceMinutes, audience, nextUpdateAt: new Date(Date.now() + cadenceMinutes * 60000) },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await auditCoreRecord(req, 'incident.communication_plan_updated', incident, null, { cadenceMinutes, audience, nextUpdateAt: plan.nextUpdateAt });
    res.json({ plan });
  } catch (e) { res.status(e.statusCode || 400).json({ error: e.message }); }
});
router.post('/incidents/:id/communications', ...coreItesmGuard('records.update'), async (req, res) => {
  try {
    const incident = await findTenantRecord(Inc, req.params.id, T(req).tenantId, 'Incident');
    await assertCoreRecordAccess(req, 'records.update', incident);
    if (!incident.isMajor) throw new ApiError(422, 'Communications require a declared major incident');
    const message = String(req.body.message || '').trim();
    const audience = String(req.body.audience || '');
    if (!message) throw new ApiError(422, 'Communication message is required');
    if (!['internal', 'customer', 'public'].includes(audience)) throw new ApiError(422, 'Invalid communication audience');
    const Communication = require('../models/MajorIncidentCommunication');
    const communication = await Communication.create({ company: T(req).tenantId, incident: incident._id, audience, message, actor: req.agent._id, actorName: req.agent.name });
    incident.timeline.push({ at: communication.deliveredAt, by: req.agent.name, message: `[COMMUNICATION:${audience}] ${message}` });
    await incident.save();
    await auditCoreRecord(req, 'incident.communication_sent', incident, null, { communicationId: communication._id, audience, message });
    res.status(201).json({ communication });
  } catch (e) { res.status(e.statusCode || 400).json({ error: e.message }); }
});
router.get('/incidents/:id/communications', ...coreItesmGuard('records.view'), async (req, res) => {
  try {
    const incident = await findTenantRecord(Inc, req.params.id, T(req).tenantId, 'Incident');
    await assertCoreRecordAccess(req, 'records.view', incident);
    const Communication = require('../models/MajorIncidentCommunication');
    res.json({ communications: await Communication.find({ company: T(req).tenantId, incident: incident._id }).sort({ createdAt: -1 }) });
  } catch (e) { res.status(e.statusCode || 400).json({ error: e.message }); }
});
router.put('/incidents/:id', ...coreItesmGuard('records.update'), async (req, res) => {
  try {
    const inc = await findTenantRecord(Inc, req.params.id, T(req).tenantId, 'Incident');
    await assertCoreRecordAccess(req, 'records.update', inc);
    const before = { title: inc.title, summary: inc.summary, severity: inc.severity, status: inc.status };
    if (req.body.isMajor !== undefined) throw new ApiError(422, 'Use the dedicated major-incident declaration action');
    const body = pick(req.body, ['title', 'description', 'summary', 'severity', 'commander', 'team', 'affectedServices', 'resolution']);
    if (req.body.status === 'resolved') {
      if (!String(req.body.resolution || '').trim()) throw new ApiError(422, 'A resolution summary is required');
      if (!inc.resolvedAt) body.resolvedAt = new Date();
    }
    if (req.body.status && req.body.status !== inc.status) {
      const previousStatus = inc.status;
      await transitionRecord({ entity: 'incident', doc: inc, to: req.body.status, stamp: body });
      inc.timeline.push({ at: new Date(), by: req.agent.name || '', message: `Status changed from ${previousStatus} to ${inc.status}` });
      inc.updates.push({ at: new Date(), status: inc.status, message: body.resolution || `Status changed from ${previousStatus}` });
      await inc.save();
    } else {
      Object.assign(inc, body);
      await inc.save();
    }
    await auditCoreRecord(req, 'incident.updated', inc, before, { title: inc.title, summary: inc.summary, severity: inc.severity, status: inc.status });
    res.json({ incident: inc });
  } catch (e) { res.status(e.statusCode === 422 ? 422 : e.statusCode || 400).json({ error: e.message }); }
});

router.get('/changes', ...coreItesmGuard('records.view'), requireTenantScope, async (req, res) => {
  try { res.json({ changes: await Chg.find(companyOf(req)).sort({ createdAt: -1 }).limit(300) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/changes', ...coreItesmGuard('records.create'), async (req, res) => {
  try {
    changeInput(req.body, { creating: true });
    const chg = await Chg.create({
      number: await nextNumber(T(req).tenantId, 'CHG'),
      title: String(req.body.title).trim(),
      description: req.body.description,
      type: req.body.type || 'normal',
      risk: req.body.risk || req.body.riskLevel || 'medium',
      status: 'for_approval',
      implementationPlan: req.body.implementationPlan,
      rollbackPlan: req.body.rollbackPlan,
      windowStart: req.body.windowStart,
      windowEnd: req.body.windowEnd,
      linkedAssets: req.body.linkedAssets || [],
      linkedTickets: req.body.linkedTickets || [],
      submittedBy: req.agent._id,
      submittedAt: new Date(),
      ...companyOf(req),
    });
    // Score + report calendar conflicts immediately so the requester sees
    // CAB-relevant risk before approval.
    let conflicts = { overlapping: [], blackouts: [], sharedAssets: [] };
    try {
      conflicts = await findChangeConflicts({
        Change: Chg, BlackoutWindow, tenantId: T(req).tenantId,
        windowStart: chg.windowStart, windowEnd: chg.windowEnd, assetIds: chg.linkedAssets,
      });
      chg.riskScore = scoreChangeRisk(chg, conflicts);
      await chg.save();
      // Automation (MD ITSM-05/ITSM-CAB): block high-risk changes whose
      // schedule collides with an existing change or a blackout window.
      const hardBlock =
        conflicts.overlapping.length > 0 &&
        (chg.windowStart || chg.windowEnd) &&
        chg.riskScore >= (Number(process.env.CHANGE_AUTO_BLOCK_RISK) || 60);
      if (hardBlock) {
        chg.status = 'rejected';
        chg.rejectionReason =
          `Auto-blocked: schedule conflicts with ${conflicts.overlapping.length} existing change(s) and high risk (${chg.riskScore}/100).`;
        await chg.save();
      }
    } catch (_) { /* scoring is advisory */ }
    await auditCoreRecord(req, 'change.created', chg, null, { number: chg.number, title: chg.title, type: chg.type, risk: chg.risk, status: chg.status });
    res.json({ change: chg, conflicts });
  } catch (e) { res.status(e.statusCode || 400).json({ error: e.message }); }
});

// Change-conflict check (MD ITSM-05): overlapping scheduled changes,
// blackout collisions, shared-asset (CI) overlaps. Advisory (never blocks).
router.get('/changes/conflicts', async (req, res) => {
  try {
    const assets = String(req.query.assets || '').split(',').map((a) => a.trim()).filter(Boolean);
    const conflicts = await findChangeConflicts({
      Change: Chg, BlackoutWindow, tenantId: T(req).tenantId,
      windowStart: req.query.start, windowEnd: req.query.end,
      assetIds: assets, excludeId: req.query.excludeId || null,
    });
    res.json({ conflicts });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/changes/:id', ...coreItesmGuard('records.update'), async (req, res) => {
  try {
    const chg = await findTenantRecord(Chg, req.params.id, T(req).tenantId, 'Change');
    await assertCoreRecordAccess(req, 'records.update', chg);
    changeInput(req.body);
    const before = { title: chg.title, type: chg.type, risk: chg.risk, status: chg.status, implementationPlan: chg.implementationPlan, rollbackPlan: chg.rollbackPlan, validationPlan: chg.validationPlan };
    const body = pick(req.body, ['title', 'description', 'type', 'risk', 'implementationPlan', 'rollbackPlan', 'windowStart', 'windowEnd', 'linkedAssets', 'linkedTickets']);
    if (body.title !== undefined) {
      body.title = String(body.title).trim();
      requiredEvidence(body.title, 'Change title');
    }
    if (req.body.validationPlan !== undefined) body.validationPlan = req.body.validationPlan;
    const targetStatus = req.body.status;
    if (targetStatus === 'scheduled') {
      requiredEvidence(body.implementationPlan ?? chg.implementationPlan, 'Implementation plan');
      requiredEvidence(body.rollbackPlan ?? chg.rollbackPlan, 'Rollback plan');
    }
    if (targetStatus === 'closed') requiredEvidence(body.validationPlan ?? chg.validationPlan, 'Validation plan');
    if (targetStatus === 'implementing') {
      body.implementedBy = req.agent._id;
      body.implementedAt = new Date();
    }
    if (targetStatus === 'validating') body.validatedAt = new Date();
    if (targetStatus === 'closed') body.closedAt = new Date();
    const apply = async () => {
      if (req.body.status && req.body.status !== chg.status) {
        await transitionRecord({ entity: 'change', doc: chg, to: req.body.status, stamp: body });
      } else {
        Object.assign(chg, body);
        await chg.save();
      }
    };
    await apply();
    // Re-score risk against the live calendar after every mutation.
    try {
      const conflicts = await findChangeConflicts({
        Change: Chg, BlackoutWindow, tenantId: T(req).tenantId,
        windowStart: chg.windowStart, windowEnd: chg.windowEnd,
        assetIds: chg.linkedAssets, excludeId: chg._id,
      });
      chg.riskScore = scoreChangeRisk(chg, conflicts);
      await chg.save();
    } catch (_) { /* scoring is advisory */ }
    await auditCoreRecord(req, 'change.updated', chg, before, { title: chg.title, type: chg.type, risk: chg.risk, status: chg.status, implementationPlan: chg.implementationPlan, rollbackPlan: chg.rollbackPlan, validationPlan: chg.validationPlan });
    res.json({ change: chg });
  } catch (e) { res.status(e.statusCode === 422 ? 422 : e.statusCode || 400).json({ error: e.message }); }
});

router.get('/problems', ...coreItesmGuard('records.view'), requireTenantScope, async (req, res) => {
  try { res.json({ problems: await Prb.find(companyOf(req)).sort({ createdAt: -1 }).limit(300) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/problems', ...coreItesmGuard('records.create'), async (req, res) => {
  try {
    if (!String(req.body.title || '').trim()) throw new ApiError(422, 'Problem title is required');
    const prb = await Prb.create({
      number: await nextNumber(T(req).tenantId, 'PRB'),
      title: String(req.body.title).trim(),
      description: req.body.description,
      rootCause: req.body.rootCause,
      workaround: req.body.workaround,
      knownError: !!req.body.knownError,
      status: 'open',
      createdBy: req.agent._id,
      ...companyOf(req),
    });
    await auditCoreRecord(req, 'problem.created', prb, null, { number: prb.number, title: prb.title, status: prb.status, knownError: prb.knownError });
    res.json({ problem: prb });
  } catch (e) { res.status(e.statusCode || 400).json({ error: e.message }); }
});
router.put('/problems/:id', ...coreItesmGuard('records.update'), async (req, res) => {
  try {
    const prb = await findTenantRecord(Prb, req.params.id, T(req).tenantId, 'Problem');
    await assertCoreRecordAccess(req, 'records.update', prb);
    const before = { title: prb.title, status: prb.status, rootCause: prb.rootCause, workaround: prb.workaround, permanentSolution: prb.permanentSolution, postmortem: prb.postmortem, knownError: prb.knownError };
    const body = pick(req.body, ['title', 'description', 'rootCause', 'workaround', 'permanentSolution', 'postmortem', 'knownError', 'linkedIncidents', 'linkedChanges', 'linkedTickets']);
    if (body.title !== undefined) {
      body.title = String(body.title).trim();
      requiredEvidence(body.title, 'Problem title');
    }
    if (req.body.status === 'known_error') {
      requiredEvidence(body.rootCause ?? prb.rootCause, 'Root cause');
      requiredEvidence(body.workaround ?? prb.workaround, 'Workaround');
      body.knownError = true;
    }
    if (req.body.status === 'fixed') requiredEvidence(body.permanentSolution ?? prb.permanentSolution, 'Permanent solution');
    if (req.body.status === 'closed') {
      requiredEvidence(body.postmortem ?? prb.postmortem, 'Postmortem');
      body.closedAt = new Date();
    }
    if (req.body.status && req.body.status !== prb.status) {
      await transitionRecord({ entity: 'problem', doc: prb, to: req.body.status, stamp: body });
    } else {
      Object.assign(prb, body);
      await prb.save();
    }
    await auditCoreRecord(req, 'problem.updated', prb, before, { title: prb.title, status: prb.status, rootCause: prb.rootCause, workaround: prb.workaround, permanentSolution: prb.permanentSolution, postmortem: prb.postmortem, knownError: prb.knownError });
    res.json({ problem: prb });
  } catch (e) { res.status(e.statusCode === 422 ? 422 : e.statusCode || 400).json({ error: e.message }); }
});

// Canonical, audited REQ/RITM checkout. Portal users can only request for
// themselves; agents need an explicit create grant and must identify both
// requester and fulfilled-for users within their tenant.
const cartCheckoutGuard = [
  moduleRequired('helpdesk'),
  async (req, _res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Not authorized');
      if (req.agent) await authorizeAgentCommand({ req, permission: 'records.create', resource: { type: 'service_request' } });
      next();
    } catch (error) { next(error); }
  },
];
const auditServiceRequest = (req, action, request, before = null, after = null) => auditRequired({
  company: T(req).tenantId, actorType: req.agent ? 'agent' : 'user', actor: (req.agent || req.user)._id,
  actorName: (req.agent || req.user).name, action, entityType: 'service_request', entityId: request._id, before, after, req,
});
router.post('/requests/cart', ...cartCheckoutGuard, async (req, res) => {
  let parent;
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length || items.length > 20) throw new ApiError(422, 'Cart must contain between 1 and 20 items');
    if (req.agent && !req.body.fulfilledFor) throw new ApiError(422, 'fulfilledFor is required when an agent submits a request');
    const requesterId = req.agent ? req.body.requester || req.user._id : req.user._id;
    const fulfilledForId = req.body.fulfilledFor || requesterId;
    if (!req.agent && (req.body.requester && String(req.body.requester) !== String(req.user._id) || String(fulfilledForId) !== String(req.user._id))) throw new ApiError(403, 'Requesters may only request for themselves');
    const [requester, fulfilledFor] = await Promise.all([User.findOne({ _id: requesterId, company: T(req).tenantId }), User.findOne({ _id: fulfilledForId, company: T(req).tenantId })]);
    if (!requester || !fulfilledFor) throw new ApiError(404, 'Requester or fulfilled-for user not found in this tenant');
    const ids = items.map((item) => String(item.catalogItemId || '')).filter(Boolean);
    if (ids.length !== items.length || new Set(ids).size !== ids.length) throw new ApiError(422, 'Every cart item needs a unique catalog item');
    const catalogItems = await ServiceCatalogItem.find({ _id: { $in: ids }, company: T(req).tenantId, isActive: true, visibleInPortal: true });
    if (catalogItems.length !== ids.length) throw new ApiError(404, 'One or more catalog items are unavailable for this tenant');
    for (const item of items) {
      const quantity = Number(item.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new ApiError(422, 'Item quantity must be between 1 and 10');
      if (item.answers !== undefined && (typeof item.answers !== 'object' || Array.isArray(item.answers))) throw new ApiError(422, 'Catalog item answers must be an object');
    }
    parent = await ServiceRequest.create({ number: await nextNumber(T(req).tenantId, 'REQ'), company: T(req).tenantId, requester: requester._id, fulfilledFor: fulfilledFor._id, status: 'pending' });
    const catalogById = new Map(catalogItems.map((item) => [String(item._id), item]));
    const requestedItems = await Promise.all(items.map(async (item) => RequestedItem.create({
      number: await nextNumber(T(req).tenantId, 'RITM'), catalogItem: catalogById.get(String(item.catalogItemId))._id,
      requester: requester._id, fulfilledFor: fulfilledFor._id, status: catalogById.get(String(item.catalogItemId)).requiresApproval ? 'pending' : 'in_progress',
      formData: { answers: item.answers || {}, quantity: Number(item.quantity ?? 1), request: parent._id }, tenantId: T(req).tenantId,
    })));
    parent.requestedItems = requestedItems.map((item) => item._id); await parent.save();
    await auditServiceRequest(req, 'service_request.created', parent, null, { number: parent.number, requester: parent.requester, fulfilledFor: parent.fulfilledFor, requestedItemCount: requestedItems.length });
    res.status(201).json({ request: { id: parent._id, number: parent.number, status: parent.status }, requestedItems: parent.requestedItems });
  } catch (error) { res.status(error.statusCode || 400).json({ error: error.message }); }
});
const serviceRequestQuery = (req) => {
  const tenant = { company: T(req).tenantId };
  if (!req.agent) return { ...tenant, $or: [{ requester: req.user._id }, { fulfilledFor: req.user._id }] };
  return isAggregateAdmin(req.agent) || grantedScopes(req.agent).includes('TENANT') ? tenant : { ...tenant, _id: null };
};
router.get('/requests/:id', moduleRequired('helpdesk'), async (req, res) => {
  try {
    if (req.agent) await authorizeAgentCommand({ req, permission: 'records.view', resource: { type: 'service_request' } });
    const request = await ServiceRequest.findOne({ _id: req.params.id, ...serviceRequestQuery(req) });
    if (!request) throw new ApiError(404, 'Service request not found');
    const requestedItems = await RequestedItem.find({ _id: { $in: request.requestedItems }, tenantId: T(req).tenantId });
    res.json({ request, requestedItems });
  } catch (error) { res.status(error.statusCode || 400).json({ error: error.message }); }
});
router.post('/requests/:id/requested-items/:itemId/fulfill', ...coreItesmGuard('records.update'), requireTenantScope, async (req, res) => {
  try {
    const request = await ServiceRequest.findOne({ _id: req.params.id, company: T(req).tenantId });
    const item = await RequestedItem.findOne({ _id: req.params.itemId, tenantId: T(req).tenantId });
    if (!request || !item || !request.requestedItems.some((itemId) => String(itemId) === String(item._id))) throw new ApiError(404, 'Requested item not found');
    if (item.status !== 'in_progress') throw new ApiError(409, 'Only in-progress requested items can be fulfilled');
    const before = { status: item.status, fulfilledAt: item.fulfilledAt }; item.status = 'fulfilled'; item.fulfilledAt = new Date(); await item.save();
    const unfinished = await RequestedItem.exists({ _id: { $in: request.requestedItems }, tenantId: T(req).tenantId, status: { $ne: 'fulfilled' } });
    const requestBefore = { status: request.status }; if (!unfinished) { request.status = 'fulfilled'; await request.save(); }
    await auditRequired({ company: T(req).tenantId, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'requested_item.fulfilled', entityType: 'requested_item', entityId: item._id, before, after: { status: item.status, fulfilledAt: item.fulfilledAt, requestId: request._id }, req });
    await auditServiceRequest(req, 'service_request.fulfillment_updated', request, requestBefore, { status: request.status, requestedItem: item._id });
    res.json({ request: { id: request._id, number: request.number, status: request.status }, requestedItem: item });
  } catch (error) { res.status(error.statusCode || 400).json({ error: error.message }); }
});

router.get('/assets', ...coreItesmGuard('records.view'), requireTenantScope, async (req, res) => {
  try { const q = { ...companyOf(req) }; if (req.query.type) q.type = req.query.type; if (req.query.search) q.$or = [{ name: RegExp(String(req.query.search), 'i') }, { serial: RegExp(String(req.query.search), 'i') }, { hostname: RegExp(String(req.query.search), 'i') }];
    res.json({ assets: await Ast.find(q).limit(300) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/assets/:id', ...coreItesmGuard('records.view'), async (req, res) => {
  try {
    const asset = await findTenantRecord(Ast, req.params.id, T(req).tenantId, 'Asset');
    await assertCoreRecordAccess(req, 'records.view', asset);
    res.json({ asset });
  } catch (e) { res.status(e.statusCode || 400).json({ error: e.message }); }
});
router.post('/assets', ...coreItesmGuard('records.create'), async (req, res) => {
  try {
    const body = pick(req.body, ['name', 'owner', 'type', 'serial', 'ip', 'hostname', 'environment', 'criticality', 'location', 'status', 'warrantyUntil', 'purchaseDate', 'tags', 'notes']);
    if (!String(body.name || '').trim()) throw new ApiError(422, 'Asset name is required');
    if (body.owner && !(await User.exists({ _id: body.owner, company: T(req).tenantId }))) throw new ApiError(404, 'Asset owner not found in this tenant');
    body.name = String(body.name).trim();
    const ast = await Ast.create({ ...body, company: T(req).tenantId, createdBy: req.agent._id });
    await auditCoreRecord(req, 'asset.created', ast, null, { name: ast.name, type: ast.type, serial: ast.serial, status: ast.status, owner: ast.owner });
    res.status(201).json({ asset: ast });
  } catch (e) { res.status(e.statusCode || 400).json({ error: e.message }); }
});
router.put('/assets/:id', ...coreItesmGuard('records.update'), async (req, res) => {
  try {
    const asset = await findTenantRecord(Ast, req.params.id, T(req).tenantId, 'Asset');
    await assertCoreRecordAccess(req, 'records.update', asset);
    const before = { name: asset.name, owner: asset.owner, type: asset.type, serial: asset.serial, status: asset.status, criticality: asset.criticality };
    const body = pick(req.body, ['name', 'owner', 'type', 'serial', 'ip', 'hostname', 'environment', 'criticality', 'location', 'status', 'warrantyUntil', 'purchaseDate', 'tags', 'notes']);
    if (body.name !== undefined) { body.name = String(body.name).trim(); if (!body.name) throw new ApiError(422, 'Asset name is required'); }
    if (body.owner && !(await User.exists({ _id: body.owner, company: T(req).tenantId }))) throw new ApiError(404, 'Asset owner not found in this tenant');
    Object.assign(asset, body); await asset.save();
    await auditCoreRecord(req, 'asset.updated', asset, before, { name: asset.name, owner: asset.owner, type: asset.type, serial: asset.serial, status: asset.status, criticality: asset.criticality });
    res.json({ asset });
  } catch (e) { res.status(e.statusCode || 400).json({ error: e.message }); }
});

router.get('/audit', async (req, res) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const A = typeof AuditLog === 'function' ? AuditLog : AuditLog.AuditLog;
    res.json({ audit: await A ? A.find(T(req)).sort({ createdAt: -1 }).limit(200) : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Phone channel (§8): call logs + log-call-to-ticket
const callsCtrl = require('../controllers/enterprise/call_logs_voice_foundation');
router.get('/calls', callsCtrl.listCallLogs);
router.post('/calls', callsCtrl.createCallLog);
router.put('/calls/:id', callsCtrl.updateCallLog);
router.post('/calls/:id/log-to-ticket', callsCtrl.logCallToTicket);
router.get('/realtime', async (req, res) => {
  try {
    const Ticket = require('../models/helpdesk/tickets/Ticket');
    const [openTickets, openIncidents, pendingChanges] = await Promise.all([
      Ticket.countDocuments({ ...T(req), status: { $nin: ['closed'] } }),
      Inc.countDocuments({ ...T(req), status: { $nin: ['resolved', 'closed'] } }),
      Chg.countDocuments({ ...T(req), status: 'pending_approval' }),
    ]);
    res.json({ stats: { openTickets, openIncidents, pendingChanges }, timestamp: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/reports/overview', async (req, res) => {
  try {
    const Ticket = require('../models/helpdesk/tickets/Ticket');
    const [total, resolved, open] = await Promise.all([
      Ticket.countDocuments(T(req)),
      Ticket.countDocuments({ ...T(req), status: 'closed' }),
      Ticket.countDocuments({ ...T(req), status: { $nin: ['closed'] } }),
    ]);
    res.json({ overview: { total, resolved, open, resolutionRate: total ? Math.round(resolved / total * 100) : 0 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Role reports (§45): agent / team / department / customer / volume / live
const metricsCtrl = require('../controllers/enterprise/search_audit_reports_realtime');
router.get('/reports/agents', metricsCtrl.agentMetricsReport);
router.get('/reports/teams', metricsCtrl.teamMetricsReport);
router.get('/reports/departments', metricsCtrl.departmentMetricsReport);
router.get('/reports/customers', metricsCtrl.customerMetricsReport);
router.get('/reports/volume', metricsCtrl.volumeTrendReport);
router.get('/reports/realtime', metricsCtrl.realTimeDashboard);

// Generic CRUD factory
function crud(path, Model, opts = {}) {
  router.get(path, async (req, res) => {
    try {
      const q = { ...T(req) };
      for (const f of (opts.filters || [])) if (req.query[f]) q[f] = req.query[f];
      if (opts.search && req.query.search) q.$or = opts.search.map(f => ({ [f]: new RegExp(String(req.query.search), 'i') }));
      const rows = await Model.find(q).sort({ createdAt: -1 }).limit(500);
      res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  router.post(path, async (req, res) => {
    try { res.status(201).json(await Model.create({ ...req.body, ...T(req), ...(opts.onCreate?.(req) || {}) })); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  router.get(`${path}/:id`, async (req, res) => {
    try { const r = await Model.findOne({ _id: req.params.id, ...T(req) }); if (!r) return res.status(404).json({}); res.json(r); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  router.put(`${path}/:id`, async (req, res) => {
    try { const r = await Model.findOneAndUpdate({ _id: req.params.id, ...T(req) }, req.body, { new: true }); if (!r) return res.status(404).json({}); res.json(r); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  router.delete(`${path}/:id`, async (req, res) => {
    try { await Model.deleteOne({ _id: req.params.id, ...T(req) }); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
}

// ---- CMDB ----
crud('/cmdb/cis', E.CI, { filters: ['ciClass', 'status', 'environment', 'criticality'], search: ['name', 'ipAddress'] });
// Service health aggregation (MD §82): BusinessService health from monitored
// CIs + firing alerts + dependency propagation.
router.get('/cmdb/services/health', async (req, res, next) => {
  try {
    const { computeServiceHealth } = require('../services/serviceHealth.service');
    const result = await computeServiceHealth(T(req).tenantId);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/cmdb/services/health/recompute', async (req, res, next) => {
  try {
    const { recomputeAllHealth } = require('../services/serviceHealth.service');
    const result = await recomputeAllHealth();
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/cmdb/services', E.BusinessService, { search: ['name'] });
router.post('/cmdb/cis/:id/relate', async (req, res) => {
  try { const ci = await E.CI.findOne({ _id: req.params.id, ...T(req) }); if (!ci) return res.status(404).json({});
    ci.relationships.push({ type: req.body.type || 'depends_on', target: req.body.targetCiId });
    await ci.save(); res.json(ci); } catch (e) { res.status(400).json({ error: e.message }); }
});
// Impact analysis: traverse depends_on graph from a CI (BFS depth 3)
router.get('/cmdb/cis/:id/impact', async (req, res) => {
  try {
    const seen = new Set(); let frontier = [String(req.params.id)]; let level = 0;
    while (frontier.length && level < 3) {
      const next = [];
      for (const id of frontier) {
        if (seen.has(id)) continue; seen.add(id);
        const ci = await E.CI.findById(id).select('relationships');
        for (const rel of ci?.relationships || []) next.push(String(rel.target));
      }
      frontier = next; level++;
    }
    seen.delete(String(req.params.id));
    const impacted = await E.CI.find({ _id: { $in: [...seen] }, ...T(req) }).select('name ciClass criticality status');
    res.json({ impactedCount: impacted.length, impacted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// CMDB health dashboard
router.get('/cmdb/health', async (req, res) => {
  try {
    const total = await E.CI.countDocuments(T(req));
    const stale = await E.CI.countDocuments({ ...T(req), $or: [{ status: 'stale' }, { lastCertifiedAt: null }] });
    const uncertified = await E.CI.countDocuments({ ...T(req), lastCertifiedAt: null });
    const noOwner = await E.CI.countDocuments({ ...T(req), owner: null });
    res.json({ total, stale, uncertified, noOwner, healthScore: total ? Math.round(100 - (uncertified / total) * 50 - (noOwner / total) * 30 - (stale / total) * 20) : 100 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- SECOPS ----
crud('/secops/incidents', E.SecurityIncident, { filters: ['severity', 'status', 'category'], search: ['title'] });
router.post('/secops/incidents/:id/triage', async (req, res) => {
  try {
    const si = await E.SecurityIncident.findOne({ _id: req.params.id, ...T(req) });
    if (!si) return res.status(404).json({});
    const sevWeight = { low: 10, medium: 35, high: 65, critical: 90 };
    si.riskScore = Math.min(100, (sevWeight[si.severity] || 20) + (si.indicators?.length || 0) * 2 + (si.affectedAssets?.length || 0) * 5);
    si.status = 'triage'; await si.save(); res.json(si);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/secops/incidents/:id/contain', async (req, res) => {
  try {
    const si = await E.SecurityIncident.findOne({ _id: req.params.id, ...T(req) });
    if (!si) return res.status(404).json({});
    si.containmentActions.push({ action: req.body.action, executedAt: new Date(), by: req.user.id, result: req.body.result });
    si.timeline.push({ at: new Date(), entry: `Containment: ${req.body.action}`, by: req.user.name });
    if (req.body.advanceStatus) si.status = req.body.advanceStatus;
    await si.save(); res.json(si);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/secops/incidents/:id/breach-assessment', async (req, res) => {
  try {
    const si = await E.SecurityIncident.findOneAndUpdate({ _id: req.params.id, ...T(req) },
      { breachAssessment: { ...req.body, assessedAt: new Date() } }, { new: true });
    res.json(si);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/secops/vulnerabilities', E.Vulnerability, { filters: ['severity', 'status'], search: ['title', 'cveId'] });
// Risk-based vulnerability scoring + SLA assignment
router.post('/secops/vulnerabilities/:id/score', async (req, res) => {
  try {
    const v = await E.Vulnerability.findOne({ _id: req.params.id, ...T(req) }).populate('asset');
    if (!v) return res.status(404).json({});
    const sev = { info: 5, low: 20, medium: 45, high: 70, critical: 90 }[v.severity] || 20;
    const exp = { none: 0, poc: 8, weaponized: 15 }[v.exploitability] || 0;
    const assetCrit = v.asset?.criticality === 'critical' ? 15 : v.asset?.criticality === 'high' ? 8 : 0;
    v.riskScore = Math.min(100, sev + exp + assetCrit);
    const slaDays = v.riskScore >= 85 ? 7 : v.riskScore >= 60 ? 30 : 90;
    v.slaDueAt = new Date(Date.now() + slaDays * 86400000);
    await v.save();
    res.json(v);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/secops/posture', async (req, res) => {
  try {
    const openVulns = await E.Vulnerability.find({ ...T(req), status: { $in: ['open', 'assigned', 'patch_scheduled'] } });
    const crit = openVulns.filter(v => v.severity === 'critical').length;
    const overdue = openVulns.filter(v => v.slaDueAt && v.slaDueAt < new Date()).length;
    const openIncidents = await E.SecurityIncident.countDocuments({ ...T(req), status: { $ne: 'closed' } });
    const score = Math.max(0, 100 - crit * 6 - overdue * 4 - openIncidents * 3);
    res.json({ postureScore: score, openVulns: openVulns.length, criticalVulns: crit, overdueRemediations: overdue, openSecurityIncidents: openIncidents });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- GRC ----
crud('/grc/risks', E.RiskItem, { filters: ['category', 'treatment'], search: ['statement'] });
router.post('/grc/risks/:id/score', async (req, res) => {
  try {
    const r = await E.RiskItem.findOne({ _id: req.params.id, ...T(req) });
    if (!r) return res.status(404).json({});
    const L = { rare: 1, unlikely: 2, possible: 3, likely: 4, almost_certain: 5 }[r.likelihood] || 3;
    const I = { negligible: 1, minor: 2, moderate: 3, major: 4, severe: 5 }[r.impact] || 3;
    r.inherentScore = L * I;
    r.residualScore = Math.max(1, Math.round(r.inherentScore * (r.treatment === 'accept' ? 1 : 0.55)));
    r.appetiteExceeded = r.residualScore > 12;
    await r.save(); res.json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/grc/controls', E.Control, { search: ['name'] });
router.post('/grc/controls/:id/test', async (req, res) => {
  try {
    const c = await E.Control.findOne({ _id: req.params.id, ...T(req) });
    if (!c) return res.status(404).json({});
    c.tests.push({ testedAt: new Date(), method: req.body.method, sampleSize: req.body.sampleSize, result: req.body.result, evidenceUrl: req.body.evidenceUrl, testedBy: req.user.name });
    c.effectiveness = req.body.result === 'effective' ? 'effective' : req.body.result === 'deficient' ? 'ineffective' : 'partially_effective';
    await c.save(); res.json(c);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/grc/policies', E.PolicyDocument, { filters: ['status'], search: ['title'] });
router.post('/grc/policies/:id/publish', async (req, res) => {
  try { const p = await E.PolicyDocument.findOneAndUpdate({ _id: req.params.id, ...T(req) }, { status: 'published', approvedBy: req.user.id, publishedAt: new Date() }, { new: true }); res.json(p); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/grc/policies/:id/acknowledge', async (req, res) => {
  try { const p = await E.PolicyDocument.findOne({ _id: req.params.id, ...T(req) });
    p.acknowledgements.push({ user: req.user.id, acknowledgedAt: new Date() }); await p.save(); res.json(p); } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/grc/audits', E.AuditEngagement, { filters: ['auditType', 'status'], search: ['name'] });
crud('/grc/third-parties', E.ThirdParty, { search: ['name'] });
crud('/grc/continuity-plans', E.ContinuityPlan, { search: ['name'] });

// ---- WORKPLACE ----
crud('/workplace/buildings', E.Building, { search: ['name'] });
crud('/workplace/spaces', E.Space, { filters: ['spaceType'], search: ['name'] });
crud('/workplace/reservations', E.Reservation, { filters: ['status'] });
router.post('/workplace/reservations/:id/checkin', async (req, res) => {
  try { const r = await E.Reservation.findOneAndUpdate({ _id: req.params.id, ...T(req), status: 'reserved' }, { status: 'checked_in', checkedInAt: new Date() }, { new: true }); if (!r) return res.status(404).json({ error: 'Not reserved' }); res.json(r); } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/workplace/visitors', E.Visitor, { filters: ['status'], search: ['fullName'] });
router.post('/workplace/visitors/:id/checkin', async (req, res) => {
  try { const v = await E.Visitor.findOneAndUpdate({ _id: req.params.id, ...T(req) }, { status: 'checked_in', checkInAt: new Date(), badgePrinted: true, watchlistHit: !!req.body.watchlistHit }, { new: true }); res.json(v); } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/workplace/moves', E.MoveRequest, { filters: ['status'] });
crud('/workplace/cases', E.WorkplaceCase, { filters: ['caseType', 'priority', 'status'], search: ['title'] });
router.get('/workplace/utilisation', async (req, res) => {
  try {
    const spaces = await E.Space.find(T(req));
    const since = new Date(Date.now() - 30 * 86400000);
    const reservations = await E.Reservation.find({ ...T(req), date: { $gte: since } });
    const utilPct = spaces.length ? Math.round((reservations.length / (spaces.length * 30)) * 100) : 0;
    res.json({ spaces: spaces.length, reservationsLast30d: reservations.length, utilisationPct: Math.min(100, utilPct) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- LEGAL ----
crud('/legal/matters', E.LegalMatter, { filters: ['practiceArea', 'status'], search: ['title'] });
router.post('/legal/matters/:id/open', async (req, res) => {
  try { const m = await E.LegalMatter.findOne({ _id: req.params.id, ...T(req) });
    if (!m.conflictCheckDone && !req.body.conflictConfirmed) return res.status(422).json({ error: 'Conflict check must be confirmed' });
    m.conflictCheckDone = true; m.status = 'open'; await m.save(); res.json(m); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/legal/matters/:id/legal-hold', async (req, res) => {
  try { const m = await E.LegalMatter.findOne({ _id: req.params.id, ...T(req) });
    m.holds.push({ custodianName: req.body.custodianName, noticeSentAt: new Date(), acknowledged: false }); await m.save(); res.json(m); } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/legal/contracts', E.ContractLifecycle, { filters: ['negotiationStatus'], search: ['title', 'counterparty'] });
router.post('/legal/contracts/:id/send-esign', async (req, res) => {
  try {
    const esign = require('../services/esign.service');
    const doc = await esign.createSignatureRequest({
      tenantId: T(req).tenantId, sentBy: req.user.id, entityType: 'contract',
      entityId: req.params.id, documentTitle: req.body.title || 'Contract',
      signerName: req.body.signerName, signerEmail: req.body.signerEmail,
    });
    const cl = await E.ContractLifecycle.findByIdAndUpdate(req.params.id, { eSignatureRequestId: doc._id }, { new: true });
    res.json({ contract: cl, signToken: doc.token });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- PROCUREMENT ----
crud('/procurement/suppliers', E.Supplier, { filters: ['onboardingStatus'], search: ['name'] });
crud('/procurement/requisitions', E.Requisition, { filters: ['status'], search: ['businessNeed'] });
router.post('/procurement/requisitions/:id/approve', async (req, res) => {
  try { const r = await E.Requisition.findOne({ _id: req.params.id, ...T(req) });
    r.approvals.push({ approverRole: req.user.role, decidedBy: req.user.id, decision: 'approved', decidedAt: new Date() });
    r.status = 'approved'; await r.save(); res.json(r); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/procurement/requisitions/:id/create-po', async (req, res) => {
  try {
    const Procurement = require('../models/stockroom').Procurement;
    const r = await E.Requisition.findOne({ _id: req.params.id, ...T(req) }).populate('lines.preferredSupplier');
    if (r.status !== 'approved') return res.status(422).json({ error: 'Requisition not approved' });
    const number = `PO-${Date.now().toString(36).toUpperCase()}`;
    const firstLine = r.lines?.[0];
    const po = await Procurement.create({
      number, product: firstLine?.description || 'Requisition bundle',
      vendor: firstLine?.preferredSupplier?.name || req.body.vendor || '',
      quantity: r.lines?.reduce((s, l) => s + (l.quantity || 0), 0) || 1,
      unitCost: firstLine?.estUnitPrice || 0,
      totalCost: r.totalEstimate || 0,
      status: 'approved', tenantId: T(req).tenantId, createdBy: req.user.id,
    });
    r.purchaseOrder = po._id; r.status = 'po_created'; await r.save();
    res.json(po);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/procurement/sourcing-events', E.SourcingEvent, { filters: ['eventType', 'status'], search: ['title'] });
router.post('/procurement/sourcing-events/:id/score', async (req, res) => {
  try {
    const ev = await E.SourcingEvent.findOne({ _id: req.params.id, ...T(req) }).populate('responses.supplier');
    if (!ev) return res.status(404).json({});
    const weights = ev.weightedCriteria || [];
    const scored = ev.responses.map(r => ({
      supplier: r.supplier?.name, technical: r.scores?.technical || 0, commercial: r.scores?.commercial || 0,
      weightedTotal: weights.reduce((s, w) => s + (w.criterion.toLowerCase().includes('commercial') ? ((r.scores?.commercial || 0) * w.weightPct / 100) : ((r.scores?.technical || 0) * w.weightPct / 100)), 0),
    })).sort((a, b) => b.weightedTotal - a.weightedTotal);
    res.json(scored);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- FINANCE ----
crud('/finance/cases', E.FinanceCase, { filters: ['caseType', 'status'], search: ['title'] });
router.post('/finance/cases/:id/decide', async (req, res) => {
  try { const fc = await E.FinanceCase.findOne({ _id: req.params.id, ...T(req) });
    fc.approvals.push({ approver: req.user.id, decision: req.body.decision, decidedAt: new Date() });
    fc.status = req.body.decision === 'approved' ? 'approved' : 'rejected';
    if (fc.status === 'resolved' || req.body.resolveNow) { fc.resolvedAt = new Date(); }
    await fc.save(); res.json(fc); } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/finance/close-tasks', E.CloseTask, { filters: ['period', 'status'], search: ['task'] });
router.post('/finance/close/:period/complete-task/:taskId', async (req, res) => {
  try { const t = await E.CloseTask.findOneAndUpdate({ _id: req.taskId || req.params.taskId, ...T(req) }, { status: 'done', completedAt: new Date(), signOffBy: req.user.id, certification: req.body.certification }, { new: true }); res.json(t); } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- ESG ----
crud('/esg/metrics', E.EsgMetric, { filters: ['pillar', 'scope', 'framework'], search: ['name'] });
crud('/esg/emission-factors', E.EmissionFactor, { search: ['name'] });
router.post('/esg/metrics/:id/data-point', async (req, res) => {
  try {
    const m = await E.EsgMetric.findOne({ _id: req.params.id, ...T(req) });
    if (!m) return res.status(404).json({});
    let co2e = null;
    if (m.scope !== 'na' && req.body.emissionFactorId) {
      const ef = await E.EmissionFactor.findById(req.body.emissionFactorId);
      if (ef) co2e = (req.body.value || 0) * ef.kgCO2ePerUnit;
    }
    m.dataPoints.push({ period: req.body.period, value: req.body.value, emissionFactorId: req.body.emissionFactorId, co2e, evidenceUrl: req.body.evidenceUrl, validatedBy: req.user.name });
    await m.save(); res.json(m);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/esg/dashboard', async (req, res) => {
  try {
    const metrics = await E.EsgMetric.find(T(req)).populate('dataPoints.emissionFactorId');
    const totals = { scope_1: 0, scope_2: 0, scope_3: 0 };
    for (const m of metrics) for (const dp of m.dataPoints || []) {
      if (dp.co2e != null && totals[m.scope] !== undefined) totals[m.scope] += dp.co2e;
    }
    const targetsMet = metrics.filter(m => m.targetValue && (m.dataPoints?.at(-1)?.value ?? 0) <= m.targetValue).length;
    res.json({ metricsTracked: metrics.length, emissionsKgCO2e: totals, totalEmissions: Object.values(totals).reduce((a, b) => a + b, 0), dataPoints: metrics.reduce((s, m) => s + (m.dataPoints?.length || 0), 0), targetsMet });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- MODULE MANAGEMENT (selection screen backend) ----
const ALL_MODULES = ['helpdesk', 'crm', 'csm', 'itam', 'cmdb', 'itom', 'projects', 'hr', 'field-service', 'secops', 'grc', 'workplace', 'legal', 'procurement', 'finance', 'esg', 'workflow', 'analytics', 'ai', 'settings'];
const MODULE_CATALOG_META = {
  helpdesk: { label: 'Help Desk / ITSM', monthlyPrice: 49, trialDays: 14, dependencies: [], incompatibleWith: [], description: 'Tickets, incidents, problems, changes, SLA, knowledge' },
  crm: { label: 'CRM', monthlyPrice: 59, trialDays: 14, dependencies: [], incompatibleWith: [], description: 'Leads, accounts, opportunities, quotes, orders' },
  csm: { label: 'Customer Service', monthlyPrice: 39, trialDays: 14, dependencies: ['helpdesk'], incompatibleWith: [], description: 'Cases, entitlements, complaints, portals' },
  itam: { label: 'IT Asset Management', monthlyPrice: 45, trialDays: 14, dependencies: [], incompatibleWith: [], description: 'Assets, licences, stockrooms, software' },
  cmdb: { label: 'CMDB', monthlyPrice: 55, trialDays: 14, dependencies: ['itam'], incompatibleWith: [], description: 'CIs, services, dependency maps, impact' },
  itom: { label: 'IT Operations', monthlyPrice: 65, trialDays: 14, dependencies: ['cmdb'], incompatibleWith: [], description: 'Discovery, alerts, correlation, remediation' },
  projects: { label: 'Projects / SPM', monthlyPrice: 55, trialDays: 14, dependencies: [], incompatibleWith: [], description: 'Portfolios, demand, tasks, sprints, OKRs' },
  hr: { label: 'HR Service Delivery', monthlyPrice: 45, trialDays: 0, dependencies: [], incompatibleWith: [], description: 'Employee cases, journeys, policies' },
  'field-service': { label: 'Field Service', monthlyPrice: 69, trialDays: 14, dependencies: ['helpdesk'], incompatibleWith: [], description: 'Work orders, technicians, maintenance' },
  secops: { label: 'Security Operations', monthlyPrice: 99, trialDays: 14, dependencies: ['cmdb'], incompatibleWith: [], description: 'Incidents, vulnerabilities, SOAR, posture' },
  grc: { label: 'Risk & Compliance', monthlyPrice: 89, trialDays: 14, dependencies: [], incompatibleWith: [], description: 'Risks, controls, policies, audits' },
  workplace: { label: 'Workplace Services', monthlyPrice: 35, trialDays: 14, dependencies: [], incompatibleWith: [], description: 'Spaces, reservations, visitors, moves' },
  legal: { label: 'Legal Service Delivery', monthlyPrice: 79, trialDays: 0, dependencies: [], incompatibleWith: [], description: 'Matters, contracts, holds, e-sign' },
  procurement: { label: 'Procurement', monthlyPrice: 75, trialDays: 14, dependencies: [], incompatibleWith: [], description: 'Suppliers, requisitions, RFx sourcing' },
  finance: { label: 'Finance Operations', monthlyPrice: 79, trialDays: 0, dependencies: ['procurement'], incompatibleWith: [], description: 'Cases, disputes, close calendar' },
  esg: { label: 'ESG Management', monthlyPrice: 85, trialDays: 0, dependencies: [], incompatibleWith: [], description: 'Metrics, Scope 1-3 carbon, disclosures' },
  workflow: { label: 'Workflow Studio', monthlyPrice: 0, trialDays: 0, dependencies: [], incompatibleWith: [], description: 'Designer, branching, versions — included free' },
  analytics: { label: 'Analytics', monthlyPrice: 0, trialDays: 0, dependencies: [], incompatibleWith: [], description: 'Builders, drill-down, exports — included free' },
  settings: { label: 'Administration', monthlyPrice: 0, trialDays: 0, dependencies: [], incompatibleWith: [], description: 'Core administration — always on', locked: true },
};

router.get('/modules/catalog', async (req, res) => {
  const mongoose = require('mongoose');
  const db = mongoose.connection.db;
  const tenantId = new mongoose.Types.ObjectId(req.user.tenantId);
  const docs = await db.collection('tenant_modules').find({ tenantId }).toArray();
  const byKey = new Map(docs.map(d => [d.moduleKey, d]));
  res.json(ALL_MODULES.map(k => {
    const meta = MODULE_CATALOG_META[k] || { label: k, monthlyPrice: 0, trialDays: 0, dependencies: [], incompatibleWith: [] };
    const doc = byKey.get(k);
    return {
      key: k, ...meta,
      status: doc ? doc.status : 'available',
      active: doc ? ['active', 'trial'].includes(doc.status) : false,
      trialEndsAt: doc?.trialEndsAt || null,
      graceUntil: doc?.graceUntil || null,
      activatedAt: doc?.activatedAt || null,
      missingDependencies: (meta.dependencies || []).filter(d => !byKey.get(d) || !['active', 'trial'].includes(byKey.get(d).status)),
      conflictsActive: (meta.incompatibleWith || []).filter(i => byKey.get(i) && ['active', 'trial'].includes(byKey.get(i).status)),
    };
  }));
});

// Plan comparison + prorated price preview before activation
router.post('/modules/preview', async (req, res) => {
  try {
    const keys = req.body.keys || [];
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const tenantId = new mongoose.Types.ObjectId(req.user.tenantId);
    const docs = await db.collection('tenant_modules').find({ tenantId }).toArray();
    const isActive = k => { const d = docs.find(x => x.moduleKey === k); return d && ['active', 'trial'].includes(d.status); };
    const lines = keys.map(k => {
      const meta = MODULE_CATALOG_META[k];
      if (!meta) return { key: k, error: 'unknown module' };
      const missing = (meta.dependencies || []).filter(d => !isActive(d));
      const already = isActive(k);
      const anchor = (docs.find(x => x.moduleKey === k)?.activatedAt) || new Date();
      const dayOfMonth = anchor.getDate();
      const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
      const proratedAmount = Math.round(meta.monthlyPrice * (daysInMonth - dayOfMonth + 1) / daysInMonth * 100) / 100;
      return { key: k, label: meta.label, monthlyPrice: meta.monthlyPrice, trialDays: meta.trialDays, alreadyActive: already, missingDependencies: missing, proratedFirstInvoice: already ? 0 : proratedAmount, blocked: missing.length > 0 };
    });
    res.json({
      lines,
      totalMonthlyNew: lines.filter(l => !l.alreadyActive && !l.blocked).reduce((s, l) => s + l.monthlyPrice, 0),
      totalDueToday: lines.reduce((s, l) => s + (l.proratedFirstInvoice || 0), 0),
      blockers: lines.filter(l => l.blocked),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/modules/history', async (req, res) => {
  try { const P5 = require('../models/platformServices'); res.json(await P5.ActivationHistory.find(T(req)).sort({ createdAt: -1 }).limit(100)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/modules/dependencies', async (req, res) => {
  try { res.json(Object.entries(MODULE_CATALOG_META).map(([key, m]) => ({ moduleKey: key, dependsOn: m.dependencies || [], incompatibleWith: m.incompatibleWith || [] }))); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/modules/:key/activate', async (req, res) => {
  try {
    if (!ALL_MODULES.includes(req.params.key)) return res.status(400).json({ error: 'Unknown module' });
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const tenantObjectId = new mongoose.Types.ObjectId(req.user.tenantId);
    const meta = MODULE_CATALOG_META[req.params.key] || {};
    const allDocs = await db.collection('tenant_modules').find({ tenantId: tenantObjectId }).toArray();
    const isActiveKey = k => { const d = allDocs.find(x => x.moduleKey === k); return d && ['active', 'trial'].includes(d.status); };
    const missing = (meta.dependencies || []).filter(d => !isActiveKey(d));
    if (missing.length) return res.status(422).json({ error: `Missing dependencies: ${missing.join(', ')}`, missingDependencies: missing });
    const mode = req.body.mode === 'trial' && (meta.trialDays || 0) > 0 ? 'trial' : 'active';
    const trialEndsAt = mode === 'trial' ? new Date(Date.now() + meta.trialDays * 86400000) : null;
    const existing = await db.collection('tenant_modules').findOne({ tenantId: tenantObjectId, moduleKey: req.params.key });
    if (existing) await db.collection('tenant_modules').updateOne({ _id: existing._id }, { $set: { status: mode, activatedAt: new Date(), trialEndsAt, graceUntil: null, source: 'manual' } });
    else await db.collection('tenant_modules').insertOne({ tenantId: tenantObjectId, moduleKey: req.params.key, status: mode, source: 'manual', activatedAt: new Date(), trialEndsAt, configuration: {} });
    await P5.ActivationHistory.create({ moduleKey: req.params.key, action: existing && ['disabled','expired','suspended'].includes(existing.status) ? 'reactivated' : 'activated', by: req.user.id, detail: `mode=${mode}`, tenantId: T(req).tenantId });
    res.json({ success: true, moduleKey: req.params.key, active: true, mode, trialEndsAt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/modules/:key/deactivate', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const graceDays = parseInt(req.body?.graceDays ?? process.env.MODULE_GRACE_DAYS ?? '30', 10);
    await db.collection('tenant_modules').updateOne(
      { tenantId: new mongoose.Types.ObjectId(req.user.tenantId), moduleKey: req.params.key },
      { $set: { status: 'disabled', disabledAt: new Date(), graceUntil: graceDays > 0 ? new Date(Date.now() + graceDays * 86400000) : null } }
    );
    await P5.ActivationHistory.create({ moduleKey: req.params.key, action: 'deactivated', by: req.user.id, detail: `graceDays=${graceDays}`, tenantId: T(req).tenantId });
    res.json({ success: true, moduleKey: req.params.key, active: false, graceDays });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/modules/:key/status', async (req, res) => {
  try {
    const allowed = ['trial', 'active', 'grace', 'suspended', 'disabled'];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ error: `status must be one of ${allowed.join(',')}` });
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const set = { status: req.body.status };
    if (req.body.status === 'trial') set.trialEndsAt = new Date(Date.now() + (req.body.trialDays || 14) * 86400000);
    if (req.body.status === 'grace') set.graceUntil = new Date(Date.now() + (req.body.graceDays || 7) * 86400000);
    const r = await db.collection('tenant_modules').findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(req.user.tenantId), moduleKey: req.params.key },
      { $set: set }, { returnDocument: 'after' }
    );
    if (!r.value && !r) return res.status(404).json({});
    await P5.ActivationHistory.create({ moduleKey: req.params.key, action: `set_${req.body.status}`, by: req.user.id, detail: JSON.stringify(set), tenantId: T(req).tenantId });
    res.json(r.value || r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/modules/:key/deactivation-impact', async (req, res) => {
  const dependents = ALL_MODULES.filter(k => (MODULE_CATALOG_META[k]?.dependencies || []).includes(req.params.key));
  res.json({ wouldAffect: dependents, requiresConfirmation: dependents.length > 0 });
});

module.exports = router;
