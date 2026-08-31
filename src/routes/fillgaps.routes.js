const express = require('express');
const { protectTenantPrincipal } = require('../middleware/auth');
const P5 = require('../models/Platform5');

const router = express.Router();
router.use(protectTenantPrincipal);
const T = req => ({ tenantId: req.user.tenantId || req.user.companyId });
function crud(path, Model) {
  router.get(path, async (req, res) => { try { res.json(await Model.find(T(req)).sort({ createdAt: -1 }).limit(300)); } catch (e) { res.status(500).json({ error: e.message }); } });
  router.post(path, async (req, res) => { try { res.status(201).json(await Model.create({ ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
  router.put(`${path}/:id`, async (req, res) => { try { const r = await Model.findOneAndUpdate({ _id: req.params.id, ...T(req) }, req.body, { new: true }); if (!r) return res.status(404).json({}); res.json(r); } catch (e) { res.status(400).json({ error: e.message }); } });
  router.delete(`${path}/:id`, async (req, res) => { try { await Model.deleteOne({ _id: req.params.id, ...T(req) }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
}

// ---- Notification preferences ----
router.get('/notification-prefs', async (req, res) => {
  try { let p = await P5.NotificationPref.findOne({ user: req.user.id }); if (!p) p = await P5.NotificationPref.create({ user: req.user.id }); res.json(p); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/notification-prefs', async (req, res) => {
  try { const p = await P5.NotificationPref.findOneAndUpdate({ user: req.user.id }, { channels: req.body.channels || {}, quietHours: req.body.quietHours || {}, digest: req.body.digest }, { new: true, upsert: true }); res.json(p); } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Compliance ----
crud('/retention-policies', P5.RetentionPolicy);
router.post('/retention-policies/:id/run', async (req, res) => {
  try {
    const pol = await P5.RetentionPolicy.findOne({ _id: req.params.id, ...T(req) });
    if (!pol) return res.status(404).json({});
    const Ticket = require('../models/Ticket');
    const cutoff = new Date(Date.now() - (pol.retainDays || 365) * 86400000);
    const q = { ...T(req), createdAt: { $lt: cutoff } };
    if (pol.action === 'archive') { const n = (await Ticket.updateMany(q, { $set: { archived: true } }).catch(() => ({ modifiedCount: 0 }))).modifiedCount || 0; pol.lastRunAt = new Date(); await pol.save(); res.json({ archived: n }); }
    else { const n = await Ticket.countDocuments(q); res.json({ wouldDelete: n, dryRun: true, note: 'Deletion runs via approved job after review' }); }
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/dsar', async (req, res) => { try { res.json(await P5.DsarRequest.find(T(req)).sort({ createdAt: -1 })); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/dsar', async (req, res) => {
  try { const dueAt = new Date(Date.now() + 30 * 86400000);
    res.status(201).json(await P5.DsarRequest.create({ ...req.body, dueAt, tenantId: T(req).tenantId })); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/dsar/:id/export', async (req, res) => {
  try {
    const d = await P5.DsarRequest.findOne({ _id: req.params.id, ...T(req) });
    if (!d) return res.status(404).json({});
    const Ticket = require('../models/Ticket');
    const tickets = await Ticket.find({ ...T(req), email: d.subjectEmail }).limit(200).lean().catch(() => []);
    const P7r = require('../models/Platform7');
    const pols = await P7r.RegionalPolicy.find({ tenantId: d.tenantId });
    const block = new Set(pols.flatMap(p2 => p2.piiExportBlocklistFields || []));
    const scrubbed = tickets.map(t2 => { const c2 = { ...t2 }; block.forEach(f => { delete c2[f]; }); return c2; });
    const payload = { subject: d.subjectEmail, generatedAt: new Date().toISOString(), tickets: scrubbed, regionPoliciesApplied: pols.length, note: 'Compiled under GDPR Art.15 / DPDPA access request' };
    d.exportPayload = { ticketCount: tickets.length }; d.status = 'completed'; await d.save();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="dsar-${d._id}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/field-masking', P5.FieldMasking);
router.get('/ip-allowlist', async (req, res) => { try { let r = await P5.FieldMasking.findOne({ ...T(req), model: '__ip_allowlist__' }); res.json({ cidrs: r ? JSON.parse(r.field || '[]') : [] }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/ip-allowlist', async (req, res) => {
  try {
    const val = JSON.stringify(req.body.cidrs || []);
    const r = await P5.FieldMasking.findOneAndUpdate({ ...T(req), model: '__ip_allowlist__' }, { field: val, maskType: 'hash' }, { new: true, upsert: true });
    res.json({ cidrs: JSON.parse(r.field) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
let pwPolicyCache = null;
router.get('/password-policy', async (req, res) => {
  try { if (!pwPolicyCache) pwPolicyCache = await P5.RetentionPolicy.findOne({ ...T(req), name: '__password_policy__' });
    res.json(pwPolicyCache?.action ? JSON.parse(pwPolicyCache.action) : { minLength: 10, requireUpper: true, requireNumber: true, requireSymbol: false, historyCount: 3, rotationDays: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/password-policy', async (req, res) => {
  try { const val = JSON.stringify(req.body);
    if (pwPolicyCache) await P5.RetentionPolicy.findByIdAndUpdate(pwPolicyCache._id, { action: val });
    else pwPolicyCache = await P5.RetentionPolicy.create({ name: '__password_policy__', entityTypes: [], action: val, ...T(req) });
    res.json(JSON.parse(val)); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/password-policy/validate', async (req, res) => {
  try {
    if (!pwPolicyCache) pwPolicyCache = await P5.RetentionPolicy.findOne({ ...T(req), name: '__password_policy__' });
    const pol = pwPolicyCache?.action ? JSON.parse(pwPolicyCache.action) : { minLength: 10, requireUpper: true, requireNumber: true };
    const pw = String(req.body.password || ''); const errors = [];
    if (pw.length < (pol.minLength || 8)) errors.push(`Minimum ${pol.minLength} characters`);
    if (pol.requireUpper && !/[A-Z]/.test(pw)) errors.push('Needs an uppercase letter');
    if (pol.requireNumber && !/[0-9]/.test(pw)) errors.push('Needs a number');
    if (pol.requireSymbol && !/[^A-Za-z0-9]/.test(pw)) errors.push('Needs a symbol');
    res.json({ valid: errors.length === 0, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/backup-tests', async (req, res) => { try { res.json(await P5.BackupTest.find(T(req)).sort({ date: -1 })); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/backup-tests', async (req, res) => { try { res.status(201).json(await P5.BackupTest.create({ ...req.body, testedBy: req.user.id, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });

// ---- CRM growth ----
crud('/campaigns', P5.Campaign);
router.post('/campaigns/:id/members', async (req, res) => {
  try { const c = await P5.Campaign.findOne({ _id: req.params.id, ...T(req) });
    c.members.push({ contact: req.body.contactId }); await c.save(); res.json(c); } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/territories', P5.Territory);
crud('/account-teams', P5.AccountTeamMember);
router.get('/crm/stage-ageing', async (req, res) => {
  try {
    const Opportunity = require('../models/Opportunity');
    const opps = await Opportunity.find({ ...T(req), stage: { $nin: ['closed_won', 'closed_lost'] } }).select('stage updatedAt');
    const byStage = {};
    for (const o of opps) { const days = Math.floor((Date.now() - o.updatedAt) / 86400000); byStage[o.stage] = byStage[o.stage] || { count: 0, totalDays: 0 }; byStage[o.stage].count++; byStage[o.stage].totalDays += days; }
    res.json(Object.entries(byStage).map(([stage, v]) => ({ stage, count: v.count, avgDaysInStage: Math.round(v.totalDays / v.count) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- ITOM ops governance ----
crud('/remediation-actions', P5.RemediationAction);
router.post('/remediation-actions/:id/execute', async (req, res) => {
  try {
    const ra = await P5.RemediationAction.findOne({ _id: req.params.id, ...T(req) });
    if (!ra) return res.status(404).json({});
    const entry = { targetRef: req.body.targetRef || '', status: ra.approvalRequired ? 'pending_approval' : 'executed', output: ra.approvalRequired ? '' : `[dry-run] ${ra.commandTemplate}`, executedBy: req.user.id, at: new Date() };
    ra.runs.push(entry); await ra.save();
    res.json(ra.runs.at(-1));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/remediation-actions/:id/approve/:runIdx', async (req, res) => {
  try {
    const ra = await P5.RemediationAction.findOne({ _id: req.params.id, ...T(req) });
    const run = ra.runs[req.params.runIdx];
    if (!run || run.status !== 'pending_approval') return res.status(422).json({ error: 'Not pending' });
    run.approvedBy = req.user.id; run.status = 'executed'; run.output = `[approved] ${ra.commandTemplate}`; run.at = new Date();
    await ra.save(); res.json(run);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/cloud-accounts', P5.CloudAccount);
router.get('/cloud-costs', async (req, res) => { try { const q = T(req); if (req.query.month) q.month = req.query.month; res.json(await P5.CloudCostEntry.find(q)); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/cloud-costs', async (req, res) => { try { res.status(201).json(await P5.CloudCostEntry.create({ ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
crud('/soar-playbooks', P5.SoarPlaybook);
router.post('/soar-playbooks/:id/run', async (req, res) => {
  try {
    const pb = await P5.SoarPlaybook.findOne({ _id: req.params.id, ...T(req) });
    const SI = require('../models/Enterprise').SecurityIncident;
    const si = await SI.findOne({ _id: req.body.incidentId, ...T(req) });
    if (!pb || !si) return res.status(404).json({});
    const executed = [];
    for (const s of (pb.steps || []).sort((a, b) => a.seq - b.seq)) {
      executed.push(s.kind);
      if (s.kind === 'containment') si.containmentActions.push({ action: s.params?.action || 'auto-contain', executedAt: new Date(), result: `via SOAR ${pb.name}` });
      if (s.kind === 'add_indicator' && s.params?.value) si.indicators.push({ type: s.params.type || 'ip', value: s.params.value });
      if (s.kind === 'notify') { const N = require('../models/Notification'); const svcN = require('../services/integrations.service'); if (await svcN.shouldSendNow(req.user.id)) await N.create({ user: req.user.id, title: `SOAR notify: ${pb.name}`, message: s.params?.message || '', read: false }).catch(() => {}); }
      if (s.kind === 'create_ticket') si.timeline.push({ at: new Date(), entry: `SOAR follow-up task: ${s.params?.title || 'review'}`, by: 'SOAR' });
    }
    si.status = si.status === 'new' ? 'triage' : si.status;
    await si.save();
    pb.runs.push({ incident: si._id, executedSteps: executed, ranAt: new Date() });
    await pb.save();
    res.json({ executedSteps: executed, incidentStatus: si.status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/threat-feeds', P5.ThreatFeed);
router.post('/threat-enrich/:incidentId', async (req, res) => {
  try {
    const SI = require('../models/Enterprise').SecurityIncident;
    const si = await SI.findOne({ _id: req.params.incidentId, ...T(req) });
    const feeds = await P5.ThreatFeed.find({ ...T(req) });
    const known = new Map(feeds.flatMap(f => f.indicators.map(i => [i.value, i.reputation])));
    let added = 0;
    for (const ind of si.indicators || []) {
      if (known.has(ind.value)) ind.reputation = known.get(ind.value);
      else if (!ind.reputation) { ind.reputation = 'unknown'; added++; }
    }
    await si.save();
    res.json({ indicators: si.indicators, matchedKnown: si.indicators.filter(i => i.reputation !== 'unknown').length, unknownAdded: added });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- SPM agile & planning ----
crud('/okrs', P5.Okr);
router.put('/okrs/:id/kr', async (req, res) => {
  try { const o = await P5.Okr.findOne({ _id: req.params.id, ...T(req) });
    o.keyResults[req.body.krIndex].current = req.body.current; await o.save(); res.json(o); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/sprints', async (req, res) => { try { const q = T(req); if (req.query.project) q.project = req.query.project; res.json(await P5.Sprint.find(q)); } catch (e) { res.status(500).json({ error: e.message }); } });
crud('/sprints', P5.Sprint);
router.post('/sprints/:id/tasks', async (req, res) => {
  try { const s = await P5.Sprint.findOne({ _id: req.params.id, ...T(req) });
    s.backlogTaskRefs.push(req.body.taskRef); await s.save(); res.json(s); } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/rate-cards', P5.RateCard);

// ---- HR manager hub ----
router.get('/manager-hub', async (req, res) => {
  try {
    const HrCase = require('../models/HrCase');
    const OnboardingChecklist = require('../models/Remaining').OnboardingChecklist;
    const [openCases, onboardings] = await Promise.all([
      HrCase.countDocuments({ ...T(req), status: { $nin: ['closed'] } }),
      OnboardingChecklist.countDocuments({ ...T(req), status: { $ne: 'completed' } }),
    ]);
    res.json({ openCases, activeOnboardings: onboardings, generatedAt: new Date().toISOString(), scopeNote: 'Counts visible within your HR-scoped permissions' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- FSM marketplace ----
crud('/contractors', P5.Contractor);
router.get('/contractor-assignments', async (req, res) => { try { res.json(await P5.ContractorAssignment.find(T(req)).populate('contractor workOrder')); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/contractor-assignments', async (req, res) => {
  try { const ca = await P5.ContractorAssignment.create({ ...req.body, accepted: false, ...T(req) });
    await P5.Contractor.findByIdAndUpdate(req.body.contractor, { status: 'assigned' });
    res.status(201).json(ca); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/contractor-assignments/:id/complete', async (req, res) => {
  try {
    const ca = await P5.ContractorAssignment.findOneAndUpdate({ _id: req.params.id, ...T(req) }, { completedAt: new Date(), performanceScore: req.body.performanceScore }, { new: true });
    const c = await P5.Contractor.findById(ca.contractor);
    c.assignmentsCompleted += 1; c.rating = Number(((c.rating * (c.assignmentsCompleted - 1) + req.body.performanceScore) / c.assignmentsCompleted).toFixed(2)); c.status = 'available';
    await c.save(); res.json({ assignment: ca, contractorRating: c.rating });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Governance docs ----
crud('/regulatory-changes', P5.RegulatoryChange);
crud('/clause-items', P5.ClauseItem);

// ---- ITAM governance ----
router.post('/software-import', async (req, res) => {
  try {
    const InstalledSoftware = require('../models/License').InstalledSoftware;
    const SoftwareProduct = require('../models/License').SoftwareProduct;
    const AssetLifecycle = null;
    const rows = req.body.rows || [];
    let matched = 0, createdProducts = 0; const results = [];
    for (const r of rows.slice(0, 200)) {
      let sp = await SoftwareProduct.findOne({ ...T(req), name: new RegExp(`^${String(r.name).replace(/[.*+?^${}()|\\[\]\\]/g, '\\$&')}$`, 'i') });
      if (!sp) { sp = await SoftwareProduct.create({ name: r.name, vendor: r.publisher, category: 'utility', ...T(req) }); createdProducts++; }
      else matched++;
      await InstalledSoftware.findOneAndUpdate({ asset: req.body.assetId, software: sp._id }, { version: r.version, publisher: r.publisher, lastChecked: new Date(), installDate: new Date(), status: 'installed' }, { upsert: true });
      results.push({ rawName: r.name, matchedProductId: sp._id, version: r.version });
    }
    const batch = await P5.SoftwareImportBatch.create({ asset: req.body.assetId, rowsCount: rows.length, matchedProducts: matched, createdProducts, unknownRows: 0, results, importedBy: req.user.id, ...T(req) });
    res.status(201).json(batch);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/reclamations', async (req, res) => {
  try {
    const LicenseAllocation = require('../models/License').LicenseAllocation;
    const alloc = await LicenseAllocation.findOne({ license: req.body.licenseId, user: req.body.userId, status: 'active', ...T(req) });
    const rec = await P5.LicenseReclamation.create({ ...req.body, lastUsedDays: req.body.lastUsedDays ?? null, managerConfirmed: false, tenantId: T(req).tenantId });
    rec.allocFound = !!alloc; await rec.save();
    res.status(201).json(rec);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/reclamations/:id/confirm', async (req, res) => {
  try {
    const rec = await P5.LicenseReclamation.findOne({ _id: req.params.id, ...T(req) });
    if (req.body.confirmed) {
      const { License, LicenseAllocation } = require('../models/License');
      await LicenseAllocation.findOneAndUpdate({ license: rec.license, user: rec.user, status: 'active' }, { status: 'deactivated', deactivatedDate: new Date() });
      await License.findByIdAndUpdate(rec.license, { $inc: { usedSeats: -1 } }).catch(() => {});
      rec.status = 'reclaimed'; rec.reclaimedAt = new Date();
    } else { rec.status = 'kept'; }
    rec.managerConfirmed = true; await rec.save(); res.json(rec);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/saas-roster', async (req, res) => {
  try {
    const LicenseAllocation = require('../models/License').LicenseAllocation;
    const UsageMeter = require('../models/License').UsageMeter;
    const allocations = await LicenseAllocation.find({ ...T(req), status: 'active' }).populate('license user');
    const roster = [];
    for (const a of allocations) {
      const lastUse = await UsageMeter.findOne({ license: a.license?._id, user: a.user?._id }).sort({ date: -1 }).limit(1);
      roster.push({ license: a.license?.name, user: a.user?.name || String(a.user), allocatedAt: a.allocatedDate, lastUsedAt: lastUse?.date || null, idleDays: lastUse ? Math.floor((Date.now() - lastUse.date) / 86400000) : null });
    }
    res.json({ seats: roster.length, idleOver30: roster.filter(r => (r.idleDays ?? 999) > 30).length, roster: roster.slice(0, 200) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/asset-audits/:id/scan', async (req, res) => {
  try {
    const AuditLogStub = null;
    const expected = req.body.expectedIds || []; const scanned = new Set(req.body.scannedIds || []);
    const missing = expected.filter(id => !scanned.has(id));
    const unexpected = [...scanned].filter(id => !expected.includes(id));
    res.json({ scannedCount: scanned.size, missingCount: missing.length, unexpectedCount: unexpected.length, missing, unexpected });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Helpdesk hygiene ----
router.get('/cab-minutes', async (req, res) => { try { const q = { ...T(req) }; if (req.query.changeId) q.change = req.query.changeId; res.json(await P5.CabMinute.find(q)); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/cab-minutes', async (req, res) => { try { res.status(201).json(await P5.CabMinute.create({ ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/five-whys/:problemId', async (req, res) => { try { res.json(await P5.FiveWhys.findOne({ problem: req.params.problemId, ...T(req) }) || null); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/five-whys/:problemId', async (req, res) => {
  try { const fw = await P5.FiveWhys.findOneAndUpdate({ problem: req.params.problemId, ...T(req) }, { whys: req.body.whys, rootCauseConclusion: req.body.rootCauseConclusion }, { new: true, upsert: true }); res.json(fw); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/worklogs/:ticketNumber', async (req, res) => {
  try { const logs = await P5.TicketWorklog.find({ ticketNumber: req.params.ticketNumber, ...T(req) });
    res.json({ entries: logs, totalMinutes: logs.reduce((s, l) => s + l.minutes, 0), billableMinutes: logs.filter(l => l.billable).reduce((s, l) => s + l.minutes, 0) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/worklogs/:ticketNumber', async (req, res) => { try { res.status(201).json(await P5.TicketWorklog.create({ ticketNumber: req.params.ticketNumber, agent: req.user.id, ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/drafts/:key', async (req, res) => { try { res.json(await P5.DraftAutosave.findOne({ user: req.user.id, contextKey: req.params.key }) || { content: '' }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/drafts/:key', async (req, res) => {
  try { const d = await P5.DraftAutosave.findOneAndUpdate({ user: req.user.id, contextKey: req.params.key }, { content: req.body.content, updatedAt: new Date() }, { new: true, upsert: true }); res.json(d); } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Integrations hub ----
crud('/connectors', P5.Connector);
router.post('/connectors/:id/test', async (req, res) => {
  try {
    const c = await P5.Connector.findOne({ _id: req.params.id, ...T(req) });
    let ok = false;
    if (c.configUrl) { try { const r = await fetch(c.configUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) }); ok = r.ok; } catch (_) { ok = false; } }
    c.status = ok ? 'healthy' : 'failing'; c.lastTestedAt = new Date(); if (ok) c.lastSuccessAt = new Date();
    await c.save(); res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/inbound-messages', async (req, res) => { try { const q = { ...T(req) }; if (req.query.channel) q.channel = req.query.channel; res.json(await P5.InboundMessage.find(q).sort({ receivedAt: -1 }).limit(100)); } catch (e) { res.status(500).json({ error: e.message }); } });
// Public-style webhook receiver for WA/FB/IG ingestion (token-gated)
router.post('/channels/webhook', async (req, res) => {
  try {
    if (req.headers['x-ingest-token'] !== (process.env.INGEST_TOKEN || 'dev-ingest')) return res.status(401).json({ error: 'bad token' });
    const Ticket = require('../models/Ticket');
    const User = require('../models/User');
    const sender = String(req.body.from || '');
    const customer = await User.findOne({ phone: sender }).select('_id').catch(() => null);
    const openExisting = customer ? await Ticket.findOne({ ...T(req), requester: customer._id, status: { $nin: ['closed'] } }) : null;
    let ticketNumber = null;
    if (!openExisting) {
      const t = await Ticket.create({ title: `[${req.body.channel}] ${String(req.body.text || '').slice(0, 60)}`, body: req.body.text, source: req.body.channel, status: 'open', tenantId: T(req).tenantId });
      ticketNumber = t.number;
    }
    const msg = await P5.InboundMessage.create({ channel: req.body.channel, from: sender, text: req.body.text, customerMatched: !!customer, ticketCreated: !openExisting, ticketNumber, tenantId: T(req).tenantId });
    res.status(201).json(msg);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/erp-connections', P5.ErpConnection);
router.post('/erp-push', async (req, res) => {
  try {
    const conn = await P5.ErpConnection.findOne({ _id: req.body.connectionId, ...T(req) });
    if (!conn || !conn.apiUrl) return res.status(422).json({ error: 'ERP not configured' });
    let ok = false; let erpRef = '';
    try {
      const r = await fetch(conn.apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(conn.apiKeyMasked ? {} : {}) }, body: JSON.stringify({ invoiceId: req.body.invoiceId }), signal: AbortSignal.timeout(6000) });
      ok = r.ok; erpRef = r.headers.get('x-ref') || '';
    } catch (_) {}
    conn.pushes.push({ invoice: req.body.invoiceId, erpRef, ok, at: new Date() });
    conn.status = ok ? 'connected' : 'error';
    await conn.save();
    res.json({ pushed: ok, erpRef, note: ok ? undefined : 'Endpoint unreachable — push logged for retry' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/kg', async (req, res) => {
  try {
    const type = req.query.type || 'cis';
    if (type === 'accounts') {
      const CH = require('../models/CustomerService').CompanyHierarchy;
      const rels = await CH.find(T(req));
      const nodes = [...new Set(rels.flatMap(r => [String(r.company), String(r.parentCompany)].filter(Boolean)))];
      const edges = rels.filter(r => r.parentCompany).map(r => ({ from: String(r.parentCompany), to: String(r.company), label: r.relationship }));
      return res.json({ nodes, edges });
    }
    const CI = require('../models/Enterprise').CI;
    const cis = await CI.find(T(req)).select('name ciClass relationships');
    const idName = new Map(cis.map(c => [String(c._id), c.name]));
    const edges = cis.flatMap(c => (c.relationships || []).map(r => ({ from: String(c._id), to: String(r.target), label: r.type })));
    res.json({ nodes: cis.map(c => ({ id: String(c._id), name: c.name, cls: c.ciClass })), edges: edges.filter(e => idName.has(e.to)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- ESG extras ----
crud('/supplier-esg', P5.ThirdParty ? require('../models/Enterprise').ThirdParty : P5.ThirdParty);
router.get('/esg-disclosure.md', async (req, res) => {
  try {
    const EsgMetric = require('../models/Enterprise').EsgMetric;
    const metrics = await EsgMetric.find(T(req)).populate('dataPoints.emissionFactorId');
    let md = `# Sustainability Disclosure Snapshot\n\n_Generated ${new Date().toISOString()}_\n\n| Metric | Framework | Scope | Last value | CO₂e (kg) |\n|---|---|---|---|---|\n`;
    for (const m of metrics) {
      const dp = m.dataPoints?.at(-1);
      md += `| ${m.name} | ${m.framework} | ${m.scope} | ${dp ? dp.value : '—'} ${m.unit || ''} | ${dp?.co2e ?? '—'} |\n`;
    }
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename="esg-disclosure.md"');
    res.send(md);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/supplier-esg', async (req, res) => {
  try { const SE = require('../models/Enterprise').ThirdParty; res.json(await SE.find(T(req))); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/supplier-esg', async (req, res) => { try { const SE = require('../models/Enterprise').ThirdParty; res.status(201).json(await SE.create({ ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });

// ---- Usage vs plan limits (§1.13) ----
router.get('/usage-summary', async (req, res) => {
  try {
    const Agent = require('../models/Agent');
    const User = require('../models/User');
    const Ticket = require('../models/Ticket');
    const Plan = require('../models/Plan');
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const [agents, contacts, ticketsThisMonth] = await Promise.all([
      Agent.countDocuments(T(req)),
      User.countDocuments({ ...T(req), role: 'client' }).catch(() => User.countDocuments(T(req))),
      Ticket.countDocuments({ ...T(req), createdAt: { $gte: monthStart } }),
    ]);
    const plans = await Plan.find({}).sort({ createdAt: -1 }).limit(1);
    const limits = plans[0]?.toObject?.() || {};
    const meter = (used, limit) => ({ used, limit: limit ?? null, over: limit != null && used > limit, pct: limit ? Math.min(100, Math.round(used / limit * 100)) : null });
    res.json({
      agents: meter(agents, limits.maxAgents),
      contacts: meter(contacts, limits.maxContacts),
      ticketsPerMonth: meter(ticketsThisMonth, limits.maxTickets),
      storageMb: meter(0, limits.storageMb),
      automationRuns: meter(0, limits.automationRuns),
      planName: limits.name || 'current',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Signed downloads for local uploads (§2.38) ----
const crypto = require('crypto');
router.post('/files/sign', async (req, res) => {
  try {
    const url = String(req.body.url || '');
    if (!url.startsWith('/uploads/')) return res.status(422).json({ error: 'Only /uploads/ paths can be signed' });
    const secret = require('../config/config').jwt.secret;
    const exp = Date.now() + 10 * 60 * 1000;
    const sig = crypto.createHmac('sha256', secret).update(`${url}|${exp}|${req.user.id}`).digest('hex').slice(0, 32);
    res.json({ token: `${exp}.${sig}`, expiresInMinutes: 10 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/files/fetch', async (req, res) => {
  try {
    const url = String(req.query.url || '');
    const [expStr, sig] = String(req.query.token || '').split('.');
    if (!url.startsWith('/uploads/') || !expStr || !sig) return res.status(400).json({ error: 'bad request' });
    if (Date.now() > Number(expStr)) return res.status(401).json({ error: 'link expired' });
    // token bound to the anonymous holder — verify signature over url+exp only
    const secret = require('../config/config').jwt.secret;
    const expect = crypto.createHmac('sha256', secret).update(`${url}|${expStr}|${req.query.uid || ''}`).digest('hex').slice(0, 32);
    if (expect !== sig) return res.status(401).json({ error: 'invalid signature' });
    const path = require('path');
    const safePath = path.join(process.cwd(), url);
    if (!safePath.includes(path.join(process.cwd(), 'uploads'))) return res.status(403).json({ error: 'outside uploads root' });
    res.sendFile(safePath);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- WhatsApp outbound (§2.35) ----
router.post('/messages/whatsapp', async (req, res) => {
  try {
    const integrations = require('../services/integrations.service');
    const result = await integrations.sendWhatsapp(String(req.body.to || ''), String(req.body.message || ''));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Invoices + payment recording (§2.45) ----
router.get('/invoices', async (req, res) => { try { const Invoice = require('../models/Invoice'); res.json(await Invoice.find(T(req)).sort({ createdAt: -1 }).limit(200)); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/invoices/:id/pay', async (req, res) => {
  try {
    const Invoice = require('../models/Invoice');
    const inv = await Invoice.findOneAndUpdate({ _id: req.params.id, ...T(req), status: 'pending' }, { status: 'paid', paidAt: new Date() }, { new: true });
    if (!inv) return res.status(422).json({ error: 'Invoice not pending or not found' });
    res.json(inv);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
