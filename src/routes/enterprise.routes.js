const express = require('express');
const { protectTenantPrincipal } = require('../middleware/auth');
const E = require('../models/Enterprise');
const P5 = require('../models/Platform5');

const router = express.Router();
router.use(protectTenantPrincipal);
const T = req => ({ tenantId: req.user.tenantId || req.user.companyId });

// ============ LEGACY COMPAT LAYER (/enterprise/* core endpoints) ============
const def = p => { const m = require(p); return typeof m === 'function' ? m : (m[Object.keys(m).find(k => typeof m[k] === 'function' && k[0] !== '_')] || m[Object.keys(m)[0]]); };
const Inc = def('../models/Incident'), Chg = def('../models/Change'), Prb = def('../models/Problem'),
      Wkf = def('../models/Workflow'), Ast = def('../models/Asset');

router.get('/workflows', async (req, res) => {
  try { res.json({ workflows: await Wkf.find(T(req)).sort({ createdAt: -1 }) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/workflows/:id', async (req, res) => {
  try { res.json({ workflow: await Wkf.findOne({ _id: req.params.id, ...T(req) }) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/workflows', async (req, res) => {
  try { const wf = await Wkf.create({ name: req.body.name, description: req.body.description, event: req.body.event || req.body.trigger || 'ticket_created', conditions: req.body.conditions || [], actions: req.body.actions || [], isActive: false, status: 'draft', isDraft: true, company: T(req).tenantId });
    res.json({ workflow: wf }); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/workflows/:id', async (req, res) => {
  try { const wf = await Wkf.findOneAndUpdate({ _id: req.params.id, ...T(req) }, req.body, { new: true });
    if (!wf) return res.status(404).json({}); res.json({ workflow: wf }); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/workflows/:id', async (req, res) => {
  try { await Wkf.deleteOne({ _id: req.params.id, ...T(req) }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ITSM records are tenant-isolated via `company` (the canonical tenant key on
// these models) with atomic per-tenant numbering (MD §68) and state-machine
// guarded status writes (MD §65). Never mass-assign req.body.
const companyOf = (req) => ({ company: T(req).tenantId });
const { nextNumber } = require('../services/numbering.service');
const { assertTransition } = require('../services/stateMachine.service');
const SEVERITY_MAP = { critical: 'Sev1', high: 'Sev2', medium: 'Sev3', low: 'Sev4', Sev1: 'Sev1', Sev2: 'Sev2', Sev3: 'Sev3', Sev4: 'Sev4' };
const pick = (src, keys) => { const out = {}; for (const k of keys) if (src[k] !== undefined) out[k] = src[k]; return out; };

router.get('/incidents', async (req, res) => {
  try { res.json({ incidents: await Inc.find(companyOf(req)).sort({ createdAt: -1 }).limit(300) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/incidents', async (req, res) => {
  try {
    const inc = await Inc.create({
      number: await nextNumber(T(req).tenantId, 'INC'),
      title: req.body.title,
      description: req.body.description,
      severity: SEVERITY_MAP[req.body.severity] || SEVERITY_MAP[req.body.priority] || 'Sev3',
      status: 'investigating',
      isMajor: !!req.body.isMajor,
      commander: req.user.id,
      timeline: [{ at: new Date(), by: req.user.name || '', message: 'Incident created' }],
      ...companyOf(req),
    });
    res.json({ incident: inc });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/incidents/:id', async (req, res) => {
  try {
    const inc = await Inc.findOne({ _id: req.params.id, ...companyOf(req) });
    if (!inc) return res.status(404).json({});
    if (req.body.status && req.body.status !== inc.status) assertTransition('incident', inc.status, req.body.status);
    Object.assign(inc, pick(req.body, ['title', 'description', 'summary', 'severity', 'status', 'commander', 'team', 'affectedServices', 'isMajor']));
    if (req.body.status === 'resolved' && !inc.resolvedAt) inc.resolvedAt = new Date();
    await inc.save();
    res.json({ incident: inc });
  } catch (e) { res.status(e.statusCode === 422 ? 422 : 400).json({ error: e.message }); }
});

router.get('/changes', async (req, res) => {
  try { res.json({ changes: await Chg.find(companyOf(req)).sort({ createdAt: -1 }).limit(300) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/changes', async (req, res) => {
  try {
    const chg = await Chg.create({
      number: await nextNumber(T(req).tenantId, 'CHG'),
      title: req.body.title,
      description: req.body.description,
      type: req.body.type || 'normal',
      risk: req.body.risk || req.body.riskLevel || 'medium',
      status: 'for_approval',
      implementationPlan: req.body.implementationPlan,
      rollbackPlan: req.body.rollbackPlan,
      windowStart: req.body.windowStart,
      windowEnd: req.body.windowEnd,
      ...companyOf(req),
    });
    res.json({ change: chg });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/changes/:id', async (req, res) => {
  try {
    const chg = await Chg.findOne({ _id: req.params.id, ...companyOf(req) });
    if (!chg) return res.status(404).json({});
    if (req.body.status && req.body.status !== chg.status) assertTransition('change', chg.status, req.body.status);
    Object.assign(chg, pick(req.body, ['title', 'description', 'status', 'type', 'risk', 'implementationPlan', 'rollbackPlan', 'windowStart', 'windowEnd']));
    await chg.save();
    res.json({ change: chg });
  } catch (e) { res.status(e.statusCode === 422 ? 422 : 400).json({ error: e.message }); }
});

router.get('/problems', async (req, res) => {
  try { res.json({ problems: await Prb.find(companyOf(req)).sort({ createdAt: -1 }).limit(300) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/problems', async (req, res) => {
  try {
    const prb = await Prb.create({
      number: await nextNumber(T(req).tenantId, 'PRB'),
      title: req.body.title,
      description: req.body.description,
      rootCause: req.body.rootCause,
      workaround: req.body.workaround,
      knownError: !!req.body.knownError,
      status: 'open',
      ...companyOf(req),
    });
    res.json({ problem: prb });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/problems/:id', async (req, res) => {
  try {
    const prb = await Prb.findOne({ _id: req.params.id, ...companyOf(req) });
    if (!prb) return res.status(404).json({});
    if (req.body.status && req.body.status !== prb.status) assertTransition('problem', prb.status, req.body.status);
    Object.assign(prb, pick(req.body, ['title', 'description', 'status', 'rootCause', 'workaround', 'permanentSolution', 'postmortem', 'knownError', 'linkedIncidents', 'linkedChanges', 'linkedTickets']));
    await prb.save();
    res.json({ problem: prb });
  } catch (e) { res.status(e.statusCode === 422 ? 422 : 400).json({ error: e.message }); }
});

router.get('/assets', async (req, res) => {
  try { const q = { ...T(req) }; if (req.query.type) q.type = req.query.type; if (req.query.search) q.$or = [{ name: RegExp(String(req.query.search), 'i') }, { serialNumber: RegExp(String(req.query.search), 'i') }];
    res.json({ assets: await Ast.find(q).limit(300) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/assets/:id', async (req, res) => {
  try { res.json({ asset: await Ast.findOne({ _id: req.params.id, ...T(req) }) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/assets', async (req, res) => {
  try { const ast = await Ast.create({ ...req.body, tenantId: T(req).tenantId }); res.json({ asset: ast }); } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/audit', async (req, res) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const A = typeof AuditLog === 'function' ? AuditLog : AuditLog.AuditLog;
    res.json({ audit: await A ? A.find(T(req)).sort({ createdAt: -1 }).limit(200) : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/realtime', async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
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
    const Ticket = require('../models/Ticket');
    const [total, resolved, open] = await Promise.all([
      Ticket.countDocuments(T(req)),
      Ticket.countDocuments({ ...T(req), status: 'closed' }),
      Ticket.countDocuments({ ...T(req), status: { $nin: ['closed'] } }),
    ]);
    res.json({ overview: { total, resolved, open, resolutionRate: total ? Math.round(resolved / total * 100) : 0 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
    const Procurement = require('../models/Stockroom').Procurement;
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
  try { const P5 = require('../models/Platform5'); res.json(await P5.ActivationHistory.find(T(req)).sort({ createdAt: -1 }).limit(100)); } catch (e) { res.status(500).json({ error: e.message }); }
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
