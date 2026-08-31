const express = require('express');
const crypto = require('crypto');
const { protectTenantPrincipal } = require('../middleware/auth');
const P6 = require('../models/Platform6');

const router = express.Router();
router.use(protectTenantPrincipal);
const T = req => ({ tenantId: req.user.tenantId || req.user.companyId });

async function execToolSafe(tool, input) {
  if (tool === 'echo') return { tool, output: input };
  if (tool === 'noop') return { tool, output: null };
  throw new Error(`Unsupported agent-chain tool: ${tool || '(empty)'}`);
}
function crud(path, Model) {
  router.get(path, async (req, res) => { try { res.json(await Model.find(T(req)).sort({ createdAt: -1 }).limit(300)); } catch (e) { res.status(500).json({ error: e.message }); } });
  router.post(path, async (req, res) => { try { res.status(201).json(await Model.create({ ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
  router.put(`${path}/:id`, async (req, res) => { try { const r = await Model.findOneAndUpdate({ _id: req.params.id, ...T(req) }, req.body, { new: true }); if (!r) return res.status(404).json({}); res.json(r); } catch (e) { res.status(400).json({ error: e.message }); } });
  router.delete(`${path}/:id`, async (req, res) => { try { await Model.deleteOne({ _id: req.params.id, ...T(req) }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
}
// Idempotency middleware
const idempotent = scope => async (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key) return next();
  try {
    const existing = await P6.IdempotencyRecord.findOne({ key, scope, ...T(req) });
    if (existing) return res.status(existing.status || 200).json({ ...(existing.responseBody || {}), __idempotentReplay: true });
    const json = res.json.bind(res);
    res.json = body => { P6.IdempotencyRecord.create({ key, scope, responseBody: body, status: res.statusCode, ...T(req) }).catch(() => {}); return json(body); };
    next();
  } catch (e) { next(e); }
};
// Quiet-hours gate (respects NotificationPref when deciding non-urgent sends)
async function quietGate(userId, tenantId) {
  try {
    const P5 = require('../models/Platform5');
    const pref = await P5.NotificationPref.findOne({ user: userId });
    if (!pref?.quietHours?.enabled) return true;
    const nowT = new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone: pref.quietHours.tz || 'UTC' }).slice(0, 5);
    const { start, end } = pref.quietHours;
    if (start <= end) return !(nowT >= start && nowT < end);
    return !(nowT >= start || nowT < end);
  } catch (_) { return true; }
}

// ---- Governance ----
router.get('/acl/rules', async (req, res) => { try { res.json(await P6.RecordAccessRule.find(T(req))); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/acl/rules', async (req, res) => { try { res.status(201).json(await P6.RecordAccessRule.create({ ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.delete('/acl/rules/:id', async (req, res) => { try { await P6.RecordAccessRule.deleteOne({ _id: req.params.id, ...T(req) }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/acl/evaluate', async (req, res) => {
  try {
    const rules = await P6.RecordAccessRule.find({ ...T(req), resourceType: req.body.resourceType }).sort({ priority: -1 });
    const record = req.body.record || {};
    let decision = 'allow';
    for (const r of rules) {
      const actual = record[r.condition?.field];
      let hit = false;
      switch (r.condition?.operator) {
        case 'equals': hit = String(actual ?? '') === String(r.condition.value ?? ''); break;
        case 'not_equals': hit = String(actual ?? '') !== String(r.condition.value ?? ''); break;
        case 'in': hit = String(r.condition.value || '').split(',').map(x => x.trim()).includes(String(actual ?? '')); break;
        case 'contains': hit = String(actual ?? '').toLowerCase().includes(String(r.condition.value ?? '').toLowerCase()); break;
      }
      if (!hit) continue;
      const roleOk = !r.rolesAllowed?.length || r.rolesAllowed.includes(req.user.role);
      if (roleOk && r.effect === 'deny') { decision = 'deny'; break; }
      if (roleOk && r.effect === 'allow') decision = 'allow';
    }
    res.json({ decision, evaluatedRules: rules.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/maintenance', async (req, res) => { try { res.json(await P6.MaintenanceFlag.findOne({ tenantId: req.user.tenantId }) || { enabled: false }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/maintenance', async (req, res) => {
  try {
    if (!['admin', 'superadmin'].includes(req.user.role)) return res.status(403).json({ error: 'Admin only' });
    res.json(await P6.MaintenanceFlag.findOneAndUpdate({ tenantId: req.user.tenantId }, { enabled: !!req.body.enabled, message: req.body.message, setBy: req.user.id }, { new: true, upsert: true }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/branding', async (req, res) => { try { res.json(await P6.BrandSetting.findOne({ tenantId: req.user.tenantId }) || {}); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/branding', async (req, res) => { try { res.json(await P6.BrandSetting.findOneAndUpdate({ tenantId: req.user.tenantId }, req.body, { new: true, upsert: true })); } catch (e) { res.status(400).json({ error: e.message }); } });
crud('/consent', P6.ConsentRecord);
router.get('/classification', async (req, res) => { try { const q = { ...T(req) }; if (req.query.entity) q.entity = req.query.entity; if (req.query.entityId) q.entityId = req.query.entityId; res.json(await P6.ClassificationTag.find(q)); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/classification', async (req, res) => { try { res.status(201).json(await P6.ClassificationTag.create({ ...req.body, taggedBy: req.user.id, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/outbox/emit', async (req, res) => { try { res.status(201).json(await P6.OutboxEvent.create({ eventType: req.body.eventType, payload: req.body.payload, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/outbox/drain', async (req, res) => {
  try {
    const pending = await P6.OutboxEvent.find({ ...T(req), published: false }).limit(50);
    let sent = 0;
    for (const ev of pending) { ev.published = true; ev.attempts += 1; await ev.save(); sent++; }
    res.json({ drained: sent, remaining: await P6.OutboxEvent.countDocuments({ ...T(req), published: false }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Help Desk depth ----
router.post('/tickets/:number/blocking', async (req, res) => { try { res.status(201).json(await P6.TicketRelationExtra.create({ ticketNumber: req.params.number, relatedNumber: req.body.relatedNumber, type: 'blocked_by', ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/tickets/:number/blocking', async (req, res) => { try { res.json(await P6.TicketRelationExtra.find({ ticketNumber: req.params.number, ...T(req) })); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/tickets/:number/clone', async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const src = await Ticket.findOne({ number: req.params.number, ...T(req) }).lean();
    if (!src) return res.status(404).json({});
    delete src._id; delete src.number; delete src.createdAt; delete src.updatedAt;
    res.status(201).json(await Ticket.create({ ...src, title: `[Clone] ${src.title || src.subject}`, status: 'open', tenantId: T(req).tenantId }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/closure-codes', (_req, res) => res.json({
  resolutionCodes: ['fixed', 'workaround', 'user_education', 'duplicate', 'no_repro', 'by_design'],
  closureCodes: ['resolved_confirmed', 'auto_closed', 'cancelled_requester', 'merged', 'expired_sla'],
}));
router.put('/tickets/:number/closure', async (req, res) => { try { res.json(await P6.ClosureMeta.findOneAndUpdate({ ticketNumber: req.params.number, ...T(req) }, { resolutionCode: req.body.resolutionCode, closureCode: req.body.closureCode }, { new: true, upsert: true })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/tickets/:number/closure/confirm', async (req, res) => {
  try { res.json(await P6.ClosureMeta.findOneAndUpdate({ ticketNumber: req.params.number, ...T(req) },
    req.body.confirmed ? { requesterConfirmed: true, confirmedAt: new Date() } : { requesterConfirmed: false, rejectedReason: req.body.reason }, { new: true, upsert: true })); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/tickets/:number', async (req, res) => { try { res.json(await P6.SoftDeleteMeta.findOneAndUpdate({ ticketNumber: req.params.number, ...T(req) }, { deletedAt: new Date(), reason: req.body.reason, by: req.user.id, restoredAt: null }, { new: true, upsert: true })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/tickets/:number/restore', async (req, res) => { try { res.json(await P6.SoftDeleteMeta.findOneAndUpdate({ ticketNumber: req.params.number, ...T(req) }, { restoredAt: new Date(), deletedAt: null }, { new: true })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/tickets-trash', async (req, res) => { try { res.json(await P6.SoftDeleteMeta.find({ ...T(req), deletedAt: { $ne: null } })); } catch (e) { res.status(500).json({ error: e.message }); } });

router.post('/routing/next-agent', async (req, res) => {
  try {
    const Agent = require('../models/Agent');
    const Ticket = require('../models/Ticket');
    const agents = await Agent.find({ tenantId: req.user.tenantId }).select('name skills').limit(200);
    if (!agents.length) return res.json({ strategy: 'none', overflowQueue: true });
    const caps = await P6.WorkScheduleCap.find({ ...T(req), agent: { $in: agents.map(a => a._id) } });
    const capMap = new Map(caps.map(c => [String(c.agent), c.dailyMaxOpen ?? 10]));
    const load = {};
    for (const a of agents) load[String(a._id)] = await Ticket.countDocuments({ assignedTo: a._id, status: { $nin: ['closed', 'resolved'] } });
    const underCap = agents.filter(a => load[String(a._id)] < (capMap.get(String(a._id)) ?? 10));
    const strategy = req.body.strategy || 'round_robin';
    let chosen = null;
    if (strategy === 'skills' && req.body.requiredSkills?.length) {
      const scored = underCap.map(a => ({ a, score: (a.skills || []).filter(s => req.body.requiredSkills.includes(s)).length })).filter(x => x.score > 0).sort((x, y) => y.score - x.score);
      chosen = scored[0]?.a;
    }
    if (!chosen && strategy === 'round_robin') {
      const scopeKey = `rr:${req.body.departmentKey || 'default'}`;
      let st = await P6.RoutingState.findOne({ scopeKey, ...T(req) });
      if (!st) st = await P6.RoutingState.create({ scopeKey, lastIndex: 0, ...T(req) });
      const pool = underCap.length ? underCap : agents;
      st.lastIndex = (st.lastIndex + 1) % pool.length;
      chosen = pool[st.lastIndex]; await st.save();
    }
    if (!chosen && underCap.length) chosen = [...underCap].sort((a, b) => load[String(a._id)] - load[String(b._id)])[0];
    if (!chosen) return res.json({ strategy, overflowQueue: true, note: 'all agents at capacity — route to overflow queue' });
    if (req.body.ticketNumber) await P6.AssignmentHistory.create({ ticketNumber: req.body.ticketNumber, toAgent: chosen._id, strategy, ...T(req) });
    res.json({ strategy, agent: { id: chosen._id, name: chosen.name, openLoad: load[String(chosen._id)] }, overflowQueue: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/routing/caps', P6.WorkScheduleCap);
router.get('/assignments/history/:ticketNumber', async (req, res) => { try { res.json(await P6.AssignmentHistory.find({ ticketNumber: req.params.ticketNumber, ...T(req) })); } catch (e) { res.status(500).json({ error: e.message }); } });

router.post('/incidents/:id/cis', async (req, res) => { try { res.json(await P6.IncidentCiMeta.findOneAndUpdate({ incident: req.params.id, ...T(req) }, { cis: req.body.cis }, { new: true, upsert: true })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/incidents/:id/communication-plan', async (req, res) => {
  try { const cp = await P6.CommunicationPlan.findOneAndUpdate({ incident: req.params.id, ...T(req) }, { cadenceMinutes: req.body.cadenceMinutes || 60, audience: req.body.audience || ['internal'], nextUpdateAt: new Date(Date.now() + (req.body.cadenceMinutes || 60) * 60000) }, { new: true, upsert: true }); res.json(cp); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/incidents/:id/communication-due', async (req, res) => {
  try {
    const cp = await P6.CommunicationPlan.findOne({ incident: req.params.id, ...T(req) });
    const due = cp && cp.nextUpdateAt <= new Date();
    if (due && cp) { cp.nextUpdateAt = new Date(Date.now() + cp.cadenceMinutes * 60000); cp.updatesSent += 1; await cp.save(); }
    res.json({ dueNow: !!due, plan: cp });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/reports/major-incidents-exec', async (req, res) => {
  try {
    const Inc = require('../models/Incident'); const Outage = require('../models/Remaining').Outage;
    const [majors, outages] = await Promise.all([
      Inc.find({ ...T(req), isMajor: true }).sort({ createdAt: -1 }).limit(20),
      Outage.find(T(req)).sort({ startedAt: -1 }).limit(20),
    ]);
    let md = '# Executive Major-Incident Summary\n\n';
    for (const i of majors) md += `- **${i.title}** (${i.severity}) — status ${i.status}, opened ${new Date(i.createdAt).toDateString()}${i.resolvedAt ? `, resolved ${new Date(i.resolvedAt).toDateString()}` : ''}\n`;
    md += '\n## Outages\n'; for (const o of outages) md += `- ${o.title} — ${o.status} (${o.severity})\n`;
    res.setHeader('Content-Type', 'text/markdown'); res.send(md);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Catalogue: bundles / eligibility / cart / parallel approvals ----
crud('/catalog/bundles', P6.CatalogBundle);
crud('/catalog/eligibility', P6.CatalogEligibility);
router.post('/catalog/cart', idempotent('cart'), async (req, res) => {
  try {
    const RequestedItem = require('../models/Remaining').RequestedItem;
    const Ticket = require('../models/Ticket');
    const items = req.body.items || [];
    if (!items.length) return res.status(400).json({ error: 'items required' });
    for (const it of items) {
      if (it.catalogItemId && it.maxPerUserPerMonth) {
        const monthStart = new Date(); monthStart.setDate(1);
        const prior = await RequestedItem.countDocuments({ ...T(req), requester: req.user.id, catalogItem: it.catalogItemId, createdAt: { $gte: monthStart } });
        if (prior >= it.maxPerUserPerMonth) return res.status(422).json({ error: `Quota exceeded for item ${it.catalogItemId}` });
      }
    }
    const parentNumber = `RITM-${Date.now().toString(36).toUpperCase()}`;
    const parent = await RequestedItem.create({ number: parentNumber, requester: req.user.id, status: 'pending', formData: { cart: true }, tenantId: T(req).tenantId });
    const children = [];
    for (const it of items) {
      const t = await Ticket.create({ title: `[Cart] ${it.name || 'Catalogue item'}`, body: JSON.stringify(it.answers || {}), source: 'portal', status: 'open', tenantId: T(req).tenantId });
      const child = await RequestedItem.create({ number: `RITM-${Date.now().toString(36).toUpperCase()}-${children.length}`, catalogItem: it.catalogItemId || undefined, ticket: t._id, requester: req.user.id, fulfilledFor: req.body.fulfilledFor || req.user.id, parentRequestRef: parent._id, tenantId: T(req).tenantId });
      children.push(child.number);
    }
    parent.formData.childNumbers = children; await parent.save();
    res.status(201).json({ parent: parent.number, children });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/approval-chains', P6.ApprovalChain);
router.post('/approval-chains/:id/decide', async (req, res) => {
  try {
    const ch = await P6.ApprovalChain.findOne({ _id: req.params.id, ...T(req) });
    if (!ch) return res.status(404).json({});
    const step = ch.steps.find(s => !s.decision);
    if (!step) return res.status(422).json({ error: 'no pending step' });
    step.decidedBy = req.user.id; step.decision = req.body.decision; step.decidedAt = new Date();
    const pendingAfter = ch.steps.filter(s => !s.decision).length;
    const rejected = ch.steps.some(s => s.decision === 'rejected');
    if (rejected) ch.status = 'rejected';
    else if (!pendingAfter) ch.status = 'approved';
    else if (ch.mode === 'any_of') ch.status = req.body.decision === 'approved' ? 'approved' : 'pending';
    await ch.save(); res.json(ch);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/blackout-windows', P6.BlackoutWindow);
crud('/ola-targets', P6.OlaTarget);
router.get('/ola-breaches', async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const olas = await P6.OlaTarget.find(T(req));
    const open = await Ticket.find({ ...T(req), status: { $nin: ['closed'] } }).select('number subject createdAt assignedTo').limit(500);
    const breaches = [];
    for (const t of open) {
      const ageMin = Math.floor((Date.now() - t.createdAt) / 60000);
      const hit = olas.find(o => (o.resolutionMinutes || 0) > 0 && ageMin > o.resolutionMinutes);
      if (hit) breaches.push({ ticket: t.number, ola: hit.name, ageMinutes: ageMin, allowed: hit.resolutionMinutes });
    }
    res.json({ breachCount: breaches.length, breaches: breaches.slice(0, 50) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/handover-notes', P6.HandoverNote);

// ---- CSM ----
crud('/community-threads', P6.CommunityThread);
router.post('/community-threads/:id/answers', async (req, res) => {
  try { const t = await P6.CommunityThread.findOne({ _id: req.params.id, ...T(req) });
    t.answers.push({ author: req.user.id, body: req.body.body }); if (t.status === 'open') t.status = 'answered'; await t.save(); res.json(t); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/community-threads/:id/accept/:answerIdx', async (req, res) => {
  try { const t = await P6.CommunityThread.findOne({ _id: req.params.id, ...T(req) });
    t.answers.forEach(a => a.accepted = false); t.answers[req.params.answerIdx].accepted = true; t.status = 'closed'; await t.save(); res.json(t); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/cases/create-with-validation', async (req, res) => {
  try {
    const Entitlement = require('../models/Entitlement');
    const Ticket = require('../models/Ticket');
    const companyId = req.body.companyId;
    const ent = await Entitlement.findOne({ company: companyId, tenantId: T(req).tenantId }).sort({ createdAt: -1 });
    if (!ent) return res.status(402).json({ error: 'No active entitlement for this account — case not created', code: 'NO_ENTITLEMENT' });
    const active = ent.status ? ent.status === 'active' : true;
    if (!active) return res.status(402).json({ error: 'Entitlement inactive', code: 'ENTITLEMENT_INACTIVE' });
    const ticket = await Ticket.create({ title: req.body.title, body: req.body.description, company: companyId, priority: req.body.severity || 'medium', status: 'open', tenantId: T(req).tenantId });
    res.status(201).json({ ticket, entitlement: ent._id, consumedAgainst: 'per-case' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/unified-inbox', async (req, res) => {
  try {
    const InboundMessage = require('../models/Platform5').InboundMessage;
    const ChatMessage = require('../models/ChatMessage');
    const [socials, chats] = await Promise.all([
      InboundMessage.find(T(req)).sort({ receivedAt: -1 }).limit(100),
      ChatMessage.find(T(req)).sort({ createdAt: -1 }).limit(100).catch(() => []),
    ]);
    const merged = [
      ...socials.map(m => ({ channel: m.channel, from: m.from, text: m.text, at: m.receivedAt })),
      ...chats.map(c => ({ channel: 'chat', from: c.senderName || String(c.sender || ''), text: c.content || c.message, at: c.createdAt })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 200);
    res.json(merged);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/customer-health/churn-risk', async (req, res) => {
  try {
    const Company = require('../models/Company');
    const Ticket = require('../models/Ticket');
    const Complaint = require('../models/CustomerService').Complaint;
    const companies = await Company.find(T(req)).limit(100);
    const out = [];
    for (const c of companies) {
      const since = new Date(Date.now() - 30 * 86400000);
      const [negSurveys, complaints] = await Promise.all([
        Ticket.countDocuments({ ...T(req), company: c._id, csat: { $lte: 2 }, createdAt: { $gte: since } }).catch(() => 0),
        Complaint.countDocuments({ ...T(req), customer: c._id, createdAt: { $gte: since } }),
      ]);
      const score = Math.min(100, negSurveys * 15 + complaints * 20);
      if (score > 0) out.push({ company: c.name, churnRiskScore: score, drivers: [negSurveys && 'negative CSAT', complaints && 'open complaints'].filter(Boolean) });
    }
    res.json(out.sort((a, b) => b.churnRiskScore - a.churnRiskScore));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- ITAM ----
const mongoose = require('mongoose');
const AssetModelCat = mongoose.models.AssetModelCat || mongoose.model('AssetModelCat', new mongoose.Schema({
  manufacturer: String, model: { type: String, required: true },
  category: String, defaultSpecs: mongoose.Schema.Types.Mixed,
  normalizedKey: { type: String, index: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true }));
crud('/asset-models-catalog', AssetModelCat);
router.post('/asset-models-catalog/normalize', async (req, res) => {
  try {
    const raw = String(req.body.modelText || '').toLowerCase().trim();
    const all = await AssetModelCat.find(T(req));
    const hit = all.find(m => raw.includes(String(m.normalizedKey || m.model).toLowerCase()));
    res.json({ normalizedTo: hit ? hit.model : null, matchedId: hit?._id || null, candidates: all.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ITAM transfers / lost-stolen / calendar / disposal cert
router.get('/transfers', async (req, res) => { try { const mongoose = require('mongoose'); const TransferOrder = mongoose.models.TransferOrder || mongoose.model('TransferOrder', new mongoose.Schema({ asset: mongoose.Schema.Types.ObjectId, fromUser: mongoose.Schema.Types.ObjectId, toUser: mongoose.Schema.Types.ObjectId, status: { type: String, enum: ['requested', 'shipped', 'received', 'accepted', 'cancelled'], default: 'requested' }, acceptanceAt: Date, tenantId: { type: mongoose.Schema.Types.ObjectId, index: true } }, { timestamps: true })); res.json(await TransferOrder.find(T(req))); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/transfers', async (req, res) => { try { const mongoose = require('mongoose'); const TransferOrder = mongoose.models.TransferOrder; res.status(201).json(await TransferOrder.create({ ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/transfers/:id/accept', async (req, res) => { try { const mongoose = require('mongoose'); const TransferOrder = mongoose.models.TransferOrder; res.json(await TransferOrder.findOneAndUpdate({ _id: req.params.id, ...T(req), status: 'received' }, { status: 'accepted', acceptanceAt: new Date() }, { new: true })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/asset-audits/scan', async (req, res) => {
  try {
    const expected = req.body.expectedIds || []; const scanned = new Set(req.body.scannedIds || []);
    res.json({ scannedCount: scanned.size, missing: expected.filter(id => !scanned.has(id)), unexpected: [...scanned].filter(id => !expected.includes(id)) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/assets/:id/lost-stolen', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const LS = mongoose.models.LostStolenReport || mongoose.model('LostStolenReport', new mongoose.Schema({ asset: mongoose.Schema.Types.ObjectId, type: { type: String, enum: ['lost', 'stolen', 'damaged'] }, policeRef: String, actions: [String], status: { type: String, default: 'open' }, tenantId: { type: mongoose.Schema.Types.ObjectId, index: true } }, { timestamps: true }));
    const rep = await LS.create({ asset: req.params.id, type: req.body.type, policeRef: req.body.policeRef, actions: ['reported'], ...T(req) });
    let securityIncident = null;
    if (req.body.type === 'stolen') {
      const SI = require('../models/Enterprise').SecurityIncident;
      securityIncident = await SI.create({ number: `SEC-${Date.now().toString(36).toUpperCase()}`, title: `Stolen asset report ${req.params.id}`, category: 'unauthorized_access', severity: 'high', tenantId: T(req).tenantId });
    }
    res.status(201).json({ report: rep, securityIncident });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/assets/:id/disposal-certificate.md', async (req, res) => {
  try {
    const AL = require('../models/Stockroom').AssetLifecycle;
    const lc = await AL.findOne({ asset: req.params.id, ...T(req) }).sort({ createdAt: -1 });
    if (!lc || !['retired', 'disposed'].includes(lc.status)) return res.status(404).json({ error: 'Asset not retired/disposed' });
    const disposalEntry = [...(lc.history || [])].reverse().find(h => h.status === 'disposed' || h.status === 'retired');
    res.setHeader('Content-Type', 'text/markdown');
    res.send(`# Certificate of Disposal\n\nAsset ID: ${req.params.id}\nLifecycle ref: ${lc._id}\nStatus: ${lc.status}\nDate: ${disposalEntry?.changedAt ? new Date(disposalEntry.changedAt).toDateString() : new Date().toDateString()}\nMethod/Notes: ${disposalEntry?.notes || 'n/a'}\nData wiping confirmed by: ____________\nAuthorised by: ${req.user.name}\n`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/itam/calendar', async (req, res) => {
  try {
    const Loaner = require('../models/Stockroom').Loaner;
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const loaners = await Loaner.find({ ...T(req), loanDate: { $gte: new Date(`${month}-01`), $lt: new Date(new Date(`${month}-01`).setMonth(new Date(`${month}-01`).getMonth() + 1)) } });
    res.json({ month, entries: loaners.map(l => ({ asset: l.asset, out: l.loanDate, due: l.expectedReturnDate, status: l.status })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/software/spend-optimisation', async (req, res) => {
  try {
    const License = require('../models/License').License;
    const SoftwareProduct = require('../models/License').SoftwareProduct;
    const licenses = await License.find(T(req));
    const spendByVendor = {};
    for (const l of licenses) { const v = l.vendor || 'unknown'; spendByVendor[v] = (spendByVendor[v] || 0) + (l.cost || 0); }
    const now = Date.now();
    const eos = [];
    for (const sp of await SoftwareProduct.find(T(req))) {
      for (const v of sp.versions || []) if (v.endOfSupport && new Date(v.endOfSupport) < now) eos.push({ product: sp.name, version: v.version, endOfSupport: v.endOfSupport });
    }
    res.json({ spendByVendor, endOfSupportList: eos.slice(0, 50), optimisationHints: Object.entries(spendByVendor).filter(([, v]) => v > 10000).map(([k]) => `Review ${k} spend (>=$10k)`) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- CMDB ----
crud('/cmdb/source-precedence', P6.CiSourcePrecedence);
router.post('/cmdb/reconcile', async (req, res) => {
  try {
    const prec = await P6.CiSourcePrecedence.findOne({ ...T(req), ciClass: req.body.ciClass });
    const ranking = prec?.ranking || [];
    const a = req.body.payloadA || {}; const b = req.body.payloadB || {};
    const rank = s => ranking.find(r => r.source === s)?.rank ?? 99;
    const mergedFields = {}; const decisions = [];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const sa = a.__source || 'sourceA'; const sb = b.__source || 'sourceB';
      const ra = rank(sa), rb = rank(sb);
      const winner = ra <= rb ? 'A' : 'B';
      mergedFields[k] = winner === 'A' ? a[k] : b[k];
      decisions.push({ field: k, winner });
    }
    res.json({ mergedFields, decisions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/cmdb/cis/dedupe-merge', async (req, res) => {
  try {
    const CI = require('../models/Enterprise').CI;
    const dupes = await CI.find({ ...T(req), identificationKey: req.body.identificationKey }).sort({ createdAt: 1 });
    if (dupes.length < 2) return res.json({ duplicatesFound: dupes.length, merged: false });
    const primary = dupes[0]; const others = dupes.slice(1);
    await CI.deleteMany({ _id: { $in: others.map(o => o._id) } });
    primary.attributes = { ...(primary.attributes || {}), mergedFrom: others.map(o => String(o._id)) };
    await primary.save();
    res.json({ duplicatesFound: dupes.length, merged: true, primaryId: primary._id, absorbed: others.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/cmdb/cis/:id/snapshot', async (req, res) => {
  try { const CI = require('../models/Enterprise').CI; const ci = await CI.findById(req.params.id); res.status(201).json(await P6.CiSnapshot.create({ ci: ci._id, state: ci.toObject(), takenBy: req.user.id, ...T(req) })); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/cmdb/cis/:id/diff', async (req, res) => {
  try {
    const snaps = await P6.CiSnapshot.find({ ci: req.params.id, ...T(req) }).sort({ takenAt: -1 }).limit(2);
    if (snaps.length < 2) return res.json({ diffable: false });
    const [newS, oldS] = snaps; const changes = [];
    for (const k of new Set([...Object.keys(newS.state || {}), ...Object.keys(oldS.state || {})])) {
      if (JSON.stringify(newS.state?.[k]) !== JSON.stringify(oldS.state?.[k])) changes.push({ field: k, from: oldS.state?.[k], to: newS.state?.[k] });
    }
    res.json({ diffable: true, comparedAt: [oldS.takenAt, newS.takenAt], changes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/cmdb/attestation-campaigns', P6.AttestationCampaign);
router.post('/cmdb/attestations/:id/certify', async (req, res) => {
  try {
    const c = await P6.AttestationCampaign.findOne({ _id: req.params.id, ...T(req) });
    c.responses.push({ ci: req.body.ciId, certified: !!req.body.certified, notes: req.body.notes, at: new Date() });
    const CI = require('../models/Enterprise').CI;
    if (req.body.certified) await CI.findByIdAndUpdate(req.body.ciId, { lastCertifiedAt: new Date() });
    if (c.cis.every(id => c.responses.some(r => String(r.ci) === String(id)))) c.status = 'closed';
    await c.save(); res.json(c);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/cmdb/cis/:id/relate-checked', async (req, res) => {
  try {
    const CARDINALITY = { part_of: { maxIncoming: 3 }, runs_on: { maxOutgoing: 5 } };
    const CI = require('../models/Enterprise').CI;
    const ci = await CI.findOne({ _id: req.params.id, ...T(req) });
    const rule = CARDINALITY[req.body.type]?.maxOutgoing;
    if (rule && ci.relationships.filter(r => r.type === req.body.type).length >= rule) return res.status(422).json({ error: `Cardinality exceeded for ${req.body.type} (max ${rule})` });
    ci.relationships.push({ type: req.body.type || 'depends_on', target: req.body.targetCiId });
    await ci.save(); res.json(ci);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/tickets/:number/link-ci', async (req, res) => { try { res.status(201).json(await P6.TicketCiLink.create({ ticketNumber: req.params.number, ci: req.body.ciId, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });

// ---- ITOM ----
const encKey2 = crypto.createHash('sha256').update(process.env.FIELD_ENC_KEY || 'field-enc-dev-key').digest();
const encryptField2 = (plain) => { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', encKey2, iv); const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]); return `${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${enc.toString('base64')}`; };
router.use('/credentials', (req, _res, next) => { if (req.body && req.body.secretEncrypted !== undefined && req.method !== 'GET') { try { req.body.secretEncrypted = encryptField2(req.body.secretEncrypted); } catch (_) {} } next(); });
crud('/credentials', P6.CredentialVault);
router.post('/credentials/rotation-sweep', async (req, res) => {
  try {
    const due = await P6.CredentialVault.find({ ...T(req), rotatesAt: { $lte: new Date(Date.now() + 7 * 86400000) } });
    const N = require('../models/Notification');
    for (const c of due) await N.create({ user: req.user.id, title: `Credential rotation due: ${c.name}`, message: `Rotate before ${c.rotatesAt}`, read: false }).catch(() => {});
    res.json({ dueCount: due.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/events/normalize', async (req, res) => {
  try {
    const Alert = require('../models/Alert').Alert || require('../models/Alert');
    const raw = req.body || {};
    const sevMap = { crit: 'critical', warn: 'medium', warning: 'medium', error: 'high', info: 'low' };
    const severity = sevMap[String(raw.severity || '').toLowerCase()] || raw.severity || 'medium';
    const dedupeKey = crypto.createHash('sha1').update(`${raw.source}|${raw.resource}|${raw.title}`).digest('hex').slice(0, 16);
    const existing = await Alert.findOne({ ...T(req), 'metadata.dedupeKey': dedupeKey, status: { $in: ['open', 'acknowledged'] } });
    const MW = require('../models/Platform2').MaintenanceWindow;
    const suppressed = await MW.countDocuments({ ...T(req), start: { $lte: new Date() }, end: { $gte: new Date() }, suppressAlerts: true });
    if (suppressed) return res.json({ suppressed: true, reason: 'maintenance_window' });
    if (existing) { existing.metadata = existing.metadata || {}; existing.metadata.repeatCount = (existing.metadata.repeatCount || 0) + 1; await existing.save(); return res.json({ deduplicated: true, alertId: existing._id, repeatCount: existing.metadata.repeatCount }); }
    const alert = await Alert.create({ title: raw.title || `${raw.source} event`, severity, description: raw.description || '', resource: raw.resourceId, status: 'open', metadata: { dedupeKey, source: raw.source }, tenantId: T(req).tenantId });
    await P6.AlertEventLog.create({ alert: alert._id, event: 'opened', ...T(req) });
    res.status(201).json(alert);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/alerts/:id/event-log', async (req, res) => { try { res.status(201).json(await P6.AlertEventLog.create({ alert: req.params.id, event: req.body.event, by: req.user.id, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/mtt-metrics', async (req, res) => {
  try {
    const logs = await P6.AlertEventLog.find(T(req)).sort({ at: 1 });
    const byAlert = new Map();
    for (const l of logs) { if (!byAlert.has(String(l.alert))) byAlert.set(String(l.alert), {}); byAlert.get(String(l.alert))[l.event] = l.at; }
    const detectToAck = [], ackToResolve = [];
    for (const t of byAlert.values()) {
      if (t.opened && t.acknowledged) detectToAck.push(new Date(t.acknowledged) - new Date(t.opened));
      if (t.acknowledged && t.resolved) ackToResolve.push(new Date(t.resolved) - new Date(t.acknowledged));
    }
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length / 60000) : null;
    res.json({ alertsTracked: byAlert.size, mttAckMinutes: avg(detectToAck), mtrMinutes: avg(ackToResolve), note: 'MTTD uses opened→acknowledged; MTR acknowledged→resolved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- SPM extras ----
crud('/roadmap-items', P6.RoadmapItem);
crud('/scenarios', P6.Scenario);
router.post('/scenarios/:id/compute', async (req, res) => {
  try {
    const sc = await P6.Scenario.findOne({ _id: req.params.id, ...T(req) });
    const Project = require('../models/Project').Project || require('../models/Project');
    const projects = await Project.find({ _id: { $in: sc.projectIds }, ...T(req) });
    const total = projects.reduce((s, p) => s + (p.budget || 0), 0);
    sc.computedTotalBudget = Math.round(total * (1 + (sc.budgetShiftPct || 0) / 100));
    const risks = await P6.RiskItem ? null : null; // risks live in Enterprise
    const RiskItem = require('../models/Enterprise').RiskItem;
    const rList = await RiskItem.find({ ...T(req) }).limit(200);
    sc.computedRiskAvg = rList.length ? Math.round(rList.reduce((s2, r) => s2 + (r.residualScore || 0), 0) / rList.length) : 0;
    await sc.save(); res.json(sc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/benefits', P6.Benefit);
crud('/decision-logs', P6.DecisionLog);

// ---- HR / Legal ----
crud('/er-investigations', P6.ErInvestigation);
router.post('/hr/doc-templates/generate', async (req, res) => {
  try {
    const t = await P6.DocTemplate.findOne({ _id: req.body.templateId, ...T(req) });
    if (!t) return res.status(404).json({});
    const User = require('../models/User');
    const emp = await User.findById(req.body.employeeId).select('name email').lean();
    let out = t.body || '';
    for (const [k, v] of Object.entries({ name: emp?.name || '', email: emp?.email || '', date: new Date().toDateString(), company: 'Our Organisation' })) {
      out = out.split(`{{${k}}}`).join(v);
    }
    let signatureToken = null;
    if (t.requiresSignature) {
      const esign = require('../services/esign.service');
      const doc = await esign.createSignatureRequest({ tenantId: T(req).tenantId, sentBy: req.user.id, entityType: 'contract', entityId: t._id, documentTitle: t.name, signerName: emp?.name || 'Employee', signerEmail: req.body.signerEmail || emp?.email });
      signatureToken = doc.token;
    }
    res.json({ generatedText: out, signatureToken });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/doc-templates', P6.DocTemplate);
crud('/legal-investigations', P6.LegalInvestigation);

// ---- Workplace floor plans + occupancy ----
router.get('/workplace/floorplan', async (req, res) => { try { const q = { ...T(req) }; if (req.query.buildingId) q.building = req.query.buildingId; res.json(await P6.FloorPlan.findOne(q).populate('placements.space') || null); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/workplace/floorplan', async (req, res) => { try { const f = await P6.FloorPlan.findOneAndUpdate({ building: req.body.buildingId, tenantId: T(req).tenantId }, { building: req.body.buildingId, floorNumber: req.body.floorNumber, placements: req.body.placements || [] }, { new: true, upsert: true }); res.json(f); } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/workplace/occupancy-ingest', async (req, res) => { try { res.status(201).json(await P6.OccupancyReading.create({ space: req.body.spaceId, count: req.body.count, capacity: req.body.capacity, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/workplace/occupancy-live', async (req, res) => {
  try {
    const since = new Date(Date.now() - 60 * 60000);
    const readings = await P6.OccupancyReading.find({ ...T(req), at: { $gte: since } }).sort({ at: -1 });
    const latestBySpace = new Map();
    for (const r of readings) if (!latestBySpace.has(String(r.space))) latestBySpace.set(String(r.space), r);
    const rows = [...latestBySpace.values()].map(r => ({ space: r.space, occupancyPct: r.capacity ? Math.round(r.count / r.capacity * 100) : null }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Procurement depth ----
crud('/change-orders', P6.ChangeOrder);
router.post('/three-way-match', async (req, res) => {
  try {
    const { orderedQty, receiptQty, invoiceQty } = req.body;
    const matched = orderedQty === receiptQty && receiptQty === invoiceQty;
    const variances = [];
    if (orderedQty !== invoiceQty) variances.push(`Invoice vs PO qty variance (${invoiceQty} vs ${orderedQty})`);
    if (receiptQty !== invoiceQty) variances.push(`Receipt vs Invoice qty variance (${receiptQty} vs ${invoiceQty})`);
    res.json(await P6.ThreeWayMatch.create({ ...req.body, matched, variances, ...T(req) }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/storefront', async (req, res) => {
  try {
    const CatalogItem = require('../models/ServiceCatalogItem');
    const Product = require('../models/Product').Product || require('../models/Product');
    const [items, products] = await Promise.all([
      CatalogItem.find(T(req)).limit(50),
      typeof Product === 'function' ? Product.find(T(req)).limit(50) : [],
    ]);
    res.json({ catalogueItems: items.map(i => ({ id: i._id, name: i.name, price: i.price, kind: 'service' })), products: products.map(p => ({ id: p._id, name: p.name, price: p.price, kind: 'product' })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/sourcing-events/:id/bid-grid', async (req, res) => {
  try {
    const SE = require('../models/Enterprise') && require('../models/Enterprise').SourcingEvent;
    const ev = await SE.findOne({ _id: req.params.id, ...T(req) }).populate('responses.supplier suppliersInvited');
    if (!ev) return res.status(404).json({});
    const weights = ev.weightedCriteria || [];
    const rows = (ev.responses || []).map(r => ({
      supplier: r.supplier?.name || String(r.supplier),
      technical: r.scores?.technical ?? null, commercial: r.scores?.commercial ?? null,
      weightedTotal: weights.reduce((s2, w) => s2 + ((w.criterion.toLowerCase().includes('commercial') ? (r.scores?.commercial || 0) : (r.scores?.technical || 0)) * w.weightPct / 100), 0),
      sealed: !!r.sealed,
    })).sort((a, b) => b.weightedTotal - a.weightedTotal);
    res.json({ event: ev.title, criteria: weights, rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Finance SoD + duplicate check ----
router.post('/finance-cases-v2', idempotent('finance-case'), async (req, res) => {
  try { const FC = require('../models/Platform5').FinanceCase; res.status(201).json(await FC.create({ ...req.body, createdBy: req.user.id, tenantId: T(req).tenantId })); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/finance/cases-safe-decide', async (req, res) => {
  try {
    const FC = require('../models/Platform5').FinanceCase;
    const fc = await FC.findOne({ _id: req.body.caseId, ...T(req) });
    if (!fc) return res.status(404).json({});
    if (String(fc.createdBy) === String(req.user.id)) return res.status(403).json({ error: 'Segregation of duties: creator cannot approve own case' });
    fc.approvals.push({ approver: req.user.id, decision: req.body.decision, decidedAt: new Date() });
    fc.status = req.body.decision === 'approved' ? 'approved' : 'rejected';
    await fc.save(); res.json(fc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/finance/duplicate-invoice-check', async (req, res) => {
  try {
    const crypto2 = require('crypto');
    const FC = require('../models/Platform5').FinanceCase;
    const hash = crypto2.createHash('sha1').update(`${req.body.supplierId}|${req.body.amount}|${req.body.period}`).digest('hex').slice(0, 12);
    const dup = await FC.findOne({ ...T(req), dedupeHash: hash }).limit(1);
    res.json({ duplicateSuspected: !!dup, fingerprint: hash, priorCaseNumber: dup?.number || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- ESG restatement + questionnaires + composer ----
router.post('/esg/metrics/:id/restate', async (req, res) => {
  try {
    const EsgMetric = require('../models/Enterprise').EsgMetric;
    const m = await EsgMetric.findOne({ _id: req.params.id, ...T(req) });
    const idx = m.dataPoints.length - 1;
    m.dataPoints.push({ period: m.dataPoints[idx].period, value: req.body.newValue, co2e: m.dataPoints[idx].co2e != null ? req.body.newValue : undefined, evidenceUrl: req.body.evidenceUrl, validatedBy: req.user.name, restatedFrom: idx });
    await m.save(); res.json(m.dataPoints.at(-1));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/esg/questionnaire-templates', P6.QuestionnaireTemplate);
router.post('/esg/supplier-responses', async (req, res) => {
  try {
    const total = (req.body.answers || []).reduce((s2, a) => s2 + (a.scorePct * (a.weightPct || 10)) / 100, 0);
    res.status(201).json(await P6.SupplierEsgResponse.create({ ...req.body, totalScorePct: Math.round(total), ...T(req) }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/esg/disclosure-composer.md', async (req, res) => {
  try {
    const framework = String(req.query.framework || 'GRI').toUpperCase();
    const EsgMetric = require('../models/Enterprise').EsgMetric;
    const metrics = (await EsgMetric.find({ ...T(req) })).filter(m => m.framework.toUpperCase() === framework);
    let md = `# ${framework} Disclosure Report\n\nGenerated: ${new Date().toISOString()}\n\n`;
    for (const pillar of ['environmental', 'social', 'governance']) {
      const set = metrics.filter(m => m.pillar === pillar);
      if (!set.length) continue;
      md += `\n## ${pillar[0].toUpperCase()}${pillar.slice(1)}\n`;
      for (const m of set) md += `- **${m.name}** (${m.scope}): last value ${m.dataPoints?.at(-1)?.value ?? '—'} ${m.unit || ''}\n`;
    }
    res.setHeader('Content-Type', 'text/markdown'); res.send(md);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Integration platform depth ----
router.post('/webhooks/dispatch-signed', async (req, res) => {
  try {
    const Webhook = require('../models/Webhook'); const WH = typeof Webhook === 'function' ? Webhook : Webhook.Webhook;
    const wh = await WH.findById(req.body.webhookId);
    if (!wh) return res.status(404).json({});
    const secret = process.env.WEBHOOK_HMAC_SECRET || 'whsec-dev';
    const payloadStr = JSON.stringify(req.body.payload || { test: true, ts: Date.now() });
    const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
    let responseStatus = 0;
    try {
      const r = await fetch(wh.url || 'http://localhost:1/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': signature }, body: payloadStr, signal: AbortSignal.timeout(5000) });
      responseStatus = r.status;
    } catch (_) {}
    const deadLettered = responseStatus >= 500 || responseStatus === 0;
    const log = await P6.WebhookDeliveryLog.create({ webhook: wh._id, eventType: req.body.eventType || 'test', payload: req.body.payload, signature, responseStatus, deadLettered, ...T(req) });
    res.json({ delivered: responseStatus >= 200 && responseStatus < 300, responseStatus, deliveryLogId: log._id, deadLettered });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/webhook-deliveries/:id/replay', async (req, res) => {
  try {
    const log = await P6.WebhookDeliveryLog.findOne({ _id: req.params.id, ...T(req) });
    const Webhook = require('../models/Webhook'); const WH = typeof Webhook === 'function' ? Webhook : Webhook.Webhook;
    const wh = await WH.findById(log.webhook);
    const signature = crypto.createHmac('sha256', process.env.WEBHOOK_HMAC_SECRET || 'whsec-dev').update(JSON.stringify(log.payload)).digest('hex');
    let responseStatus = 0;
    try { const r = await fetch(wh.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': signature }, body: JSON.stringify(log.payload), signal: AbortSignal.timeout(5000) }); responseStatus = r.status; } catch (_) {}
    log.responseStatus = responseStatus; log.attempt += 1; log.deadLettered = !(responseStatus >= 200 && responseStatus < 300); await log.save();
    res.json(log);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/webhook-dead-letters', async (req, res) => { try { res.json(await P6.WebhookDeliveryLog.find({ ...T(req), deadLettered: true })); } catch (e) { res.status(500).json({ error: e.message }); } });
crud('/synonyms', P6.SynonymMap);
const lev = (a, b) => { const m = []; for (let i = 0; i <= b.length; i++) { m[i] = [i]; for (let j = 1; j <= a.length; j++) m[i][j] = i === 0 ? j : Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[j - 1] === b[i - 1] ? 0 : 1)); } return m[b.length][a.length]; };
router.get('/search/fuzzy', async (req, res) => {
  try {
    const q = String(req.query.q || '').toLowerCase().trim(); if (!q) return res.json({ expanded: [], results: [] });
    const syn = await P6.SynonymMap.findOne({ ...T(req), term: q });
    const variants = [...new Set([q, ...(syn?.synonyms || [])])];
    const Ticket = require('../models/Ticket');
    const results = [];
    for (const v of variants) {
      const exact = await Ticket.find({ ...T(req), title: new RegExp(v, 'i') }).limit(10).select('number title status');
      results.push(...exact);
      if (!exact.length) {
        const pool = await Ticket.find(T(req)).limit(300).select('number title status');
        const near = pool.filter(t => lev(String(t.title || '').toLowerCase().slice(0, q.length + 2), v) <= 2).slice(0, 5);
        results.push(...near);
        break;
      }
    }
    res.json({ expanded: variants, results: results.slice(0, 20), note: 'typo-tolerance via Levenshtein<=2 fallback + synonym expansion' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/openapi.json', async (_req, res) => {
  try {
    const mainRouter = require('./index.js');
    const paths = {};
    const walk = (stack, base) => {
      for (const layer of stack) {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods || {});
          for (const m of methods) {
            paths[`${base}${layer.route.path}`] = paths[`${base}${layer.route.path}`] || {};
            paths[`${base}${layer.route.path}`][m] = { summary: `${m.toUpperCase()} ${layer.route.path}`, tags: ['auto'] };
          }
        } else if (layer.name === 'router' && layer.handle?.stack) walk(layer.handle.stack, base + (layer.regexp.toString().match(/\\\/([^\\]+)\\\//)?.[1] ? '/' + layer.regexp.toString().match(/\\\/([^\\]+)\\\//)[1] : ''));
      }
    };
    walk(mainRouter.stack, '');
    res.json({ openapi: '3.0.0', info: { title: 'Unified Platform API', version: 'v1-auto' }, paths });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

crud('/agent-chains', P6.AgentChain);
router.post('/agent-chains/:id/run', async (req, res) => {
  try {
    const chain = await P6.AgentChain.findOne({ _id: req.params.id, ...T(req) }).populate('steps.agent');
    const outputs = [];
    let carry = req.body.initialInput || {};
    for (const step of chain.steps || []) {
      const ag = step.agent;
      if (!ag || ag.killSwitch) { outputs.push({ skipped: true, reason: ag ? 'kill switch' : 'missing' }); continue; }
      const result = await execToolSafe(step.tool, carry, req);
      outputs.push(result); carry = result;
    }
    res.json({ stepsExecuted: outputs.filter(o => !o.skipped).length, outputs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Analytics depth ----
router.post('/reports/matrix', async (req, res) => {
  try {
    const map = { tickets: () => require('../models/Ticket'), leads: () => require('../models/Lead') };
    const M = (map[req.body.dataset] || (() => require('../models/Ticket')))();
    const rowsA = await M.aggregate([{ $match: { tenantId: req.user.tenantId } }, { $group: { _id: `$${req.body.groupByA}` , c: { $sum: 1 } } }]);
    const rowsB = await M.aggregate([{ $match: { tenantId: req.user.tenantId } }, { $group: { _id: `$${req.body.groupByB}`, c: { $sum: 1 } } }]);
    res.json({ pivot: { rowKeys: rowsA.map(r => r._id).filter(Boolean), colKeys: rowsB.map(r => r._id).filter(Boolean), note: 'cell counts via drilldown/detail per intersection' }, rowTotals: rowsA });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/reports/period-compare', async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const now = new Date(); const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [cur, prev] = await Promise.all([
      Ticket.countDocuments({ ...T(req), createdAt: { $gte: curStart } }),
      Ticket.countDocuments({ ...T(req), createdAt: { $gte: prevStart, $lt: curStart } }),
    ]);
    res.json({ current: cur, previous: prev, deltaPct: prev ? Math.round((cur - prev) / prev * 100) : null, freshnessTimestamp: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/reports/share', async (req, res) => {
  try {
    const crypto2 = require('crypto');
    const token = crypto2.randomBytes(16).toString('hex');
    await P6.IdempotencyRecord.create({ key: `share:${token}`, scope: 'report-share', responseBody: { dataset: req.body.dataset, filters: req.body.filters }, status: 200, ...T(req) });
    res.json({ shareToken: token, url: `/gaps2/reports/shared/${token}` });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Cross-module leftovers ----
router.get('/employee-360/:userId', async (req, res) => {
  try {
    const uid = req.params.userId;
    const Ticket = require('../models/Ticket');
    const AssetLifecycle = require('../models/Stockroom').AssetLifecycle;
    const TimesheetM = require('../models/Remaining').Timesheet;
    const Reservation = require('../models/Enterprise') && require('../models/Enterprise').Reservation;
    const [tickets, assets, timesheets, reservations] = await Promise.all([
      Ticket.find({ ...T(req), requester: uid }).sort({ createdAt: -1 }).limit(20).select('number title status createdAt'),
      AssetLifecycle.find({ ...T(req), assignedTo: uid }).limit(20).populate('asset', 'name'),
      TimesheetM.find({ ...T(req), agent: uid }).limit(20),
      Reservation ? Reservation.find({ ...T(req), reservedBy: uid }).limit(10) : [],
    ]);
    res.json({ tickets, assignedAssets: assets, recentTimesheets: timesheets.length, workplaceReservations: reservations });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/incidents/:id/to-problem', async (req, res) => {
  try {
    const Inc = def('../models/Incident'); const Problem = require('../models/Problem');
    const inc = await Inc.findOne({ _id: req.params.id, ...T(req) });
    if (!inc) return res.status(404).json({});
    const prb = await Problem.create({ title: `[Problem] ${inc.title}`, description: inc.description, status: 'open', tenantId: T(req).tenantId });
    res.status(201).json(prb);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
function def(p) { const m = require(p); return typeof m === 'function' ? m : (m[Object.keys(m).find(k => typeof m[k] === 'function')] || m[Object.keys(m)[0]]); }
router.post('/hardware-request-chain', async (req, res) => {
  try {
    const StockItem = require('../models/Stockroom').StockItem;
    const Requisition = require('../models/Enterprise').Requisition;
    const AL = require('../models/Stockroom').AssetLifecycle;
    const steps = [];
    let stockItem = req.body.stockItemId ? await StockItem.findById(req.body.stockItemId) : null;
    if (stockItem && stockItem.quantity > 0) {
      stockItem.quantity -= 1; await stockItem.save(); steps.push({ step: 'stock_reserved', ok: true });
      const al = await AL.create({ asset: req.body.assetId || stockItem.product, status: 'assigned', assignedTo: req.body.userId, history: [{ status: 'assigned', notes: 'hw-chain' }], tenantId: T(req).tenantId });
      steps.push({ step: 'assigned_from_stock', lifecycleId: al._id });
      return res.json({ completed: true, steps });
    }
    steps.push({ step: 'stock_insufficient', ok: false });
    const reqDoc = await Requisition.create({ requestedBy: req.body.userId, businessNeed: `Hardware request ${req.body.catalogItemId || ''}`, lines: [{ description: req.body.itemName || 'hardware', quantity: 1 }], status: 'pending_approval', tenantId: T(req).tenantId });
    steps.push({ step: 'procurement_requisition_raised', requisitionId: reqDoc._id });
    res.json({ completed: false, pendingProcurement: true, steps });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/csat-negative-recovery-sweep', async (req, res) => {
  try {
    const SurveyResponse = require('../models/SurveyResponse');
    const Task = require('../models/Task');
    const since = new Date(Date.now() - 7 * 86400000);
    const negatives = await SurveyResponse.find({ ...T(req), score: { $lte: 2 }, createdAt: { $gte: since } }).limit(50);
    let created = 0;
    for (const sr of negatives) {
      const existing = await Task.findOne({ title: { $regex: `Recovery for survey ${sr._id}` } });
      if (!existing) { await Task.create({ title: `Recovery for survey ${sr._id}`, description: `Negative feedback score ${sr.score} — follow up`, status: 'open', tenantId: T(req).tenantId }); created++; }
    }
    res.json({ negativesFound: negatives.length, recoveryTasksCreated: created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/problems/:id/generate-change', async (req, res) => {
  try {
    const Problem = require('../models/Problem');
    const Change = require('../models/Change').Change || require('../models/Change');
    const prb = await Problem.findOne({ _id: req.params.id, ...T(req) });
    if (!prb) return res.status(404).json({});
    const chg = await Change.create({ title: `[Fix] ${prb.title}`, description: `Permanent fix for problem. Root cause: ${prb.rootCause || 'pending'}. Workaround: ${prb.workaround || 'n/a'}`, type: 'normal', riskLevel: 'medium', status: 'pending_approval', implementationPlan: req.body.implementationPlan || 'Deploy permanent fix per problem record', rollbackPlan: 'Revert deployment', requestedBy: req.user.id, tenantId: T(req).tenantId });
    res.status(201).json(chg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Outbound social/WA reply on an inbound message
router.post('/inbound-messages/:id/reply', async (req, res) => {
  try {
    const InboundMessage = require('../models/Platform5').InboundMessage;
    const msg = await InboundMessage.findOne({ _id: req.params.id });
    if (!msg) return res.status(404).json({ error: 'Not found' });
    if (!msg.from) return res.status(422).json({ error: 'No sender address' });
    const svcR = require('../services/integrations.service');
    var result;
    if (msg.channel === 'whatsapp') { result = await svcR.sendWhatsapp(msg.from, req.body.text || ''); }
    else { console.log('[' + msg.channel + ':mock-reply] to=' + msg.from); result = { delivered: false, mock: true }; }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Vendor negotiation pack markdown
router.get('/licenses/vendor-pack.md', async function(req, res) {
  try {
    var LicenseM = require('../models/License').License;
    var licenses = await LicenseM.find({ tenantId: req.user.tenantId });
    var byVendor = {};
    for (var li of licenses) {
      var v = li.vendor || 'unknown';
      if (!byVendor[v]) byVendor[v] = { spend: 0, seats: 0, items: [] };
      byVendor[v].spend += (li.cost || 0);
      byVendor[v].seats += (li.totalSeats || 0);
      byVendor[v].items.push(li);
    }
    var nl = String.fromCharCode(10);
    var md = '# Vendor Negotiation Pack' + nl + nl + '_Generated ' + new Date().toISOString() + '_' + nl;
    for (var vn of Object.keys(byVendor)) {
      var d = byVendor[vn];
      md += nl + '## ' + vn + nl + '- Annual spend: $' + d.spend.toLocaleString() + nl + '- Total seats: ' + d.seats + nl;
      for (var l of d.items) { md += '  - ' + l.name + ': ' + (l.usedSeats||0) + '/' + (l.totalSeats||0) + ' seats, expires ' + new Date(l.expiryDate).toDateString() + nl; }
    }
    res.setHeader('Content-Type', 'text/markdown');
    res.send(md);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
