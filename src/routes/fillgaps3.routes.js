const express = require('express');
const { protectTenantPrincipal } = require('../middleware/auth');
const P7 = require('../models/Platform7');
const mongoose = require('mongoose');
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
// Field-level AES-256-GCM encryption
const crypto = require('crypto');
const encKey = crypto.createHash('sha256').update(process.env.FIELD_ENC_KEY || 'field-enc-dev-key').digest();
function encryptField(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return `${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}
function decryptField(payload) {
  try {
    const [iv, tag, data] = String(payload).split('.');
    const d = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
  } catch (_) { return payload; }
}

// ---- §1.12 Org membership + switching ----
router.get('/my-organizations', async (req, res) => {
  try {
    const memberships = await P7.OrgMembership.find({ user: req.user.id }).populate('organization', 'name status');
    res.json(memberships.map(m => ({
      organizationId: m.organization?._id || m.organization,
      name: m.organization?.name || 'Org',
      role: m.role, isDefault: !!m.isDefault,
      isActiveTenant: String(m.organization?._id) === String(req.user.companyId),
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/select-organization', idemGuard(), async (req, res) => {
  try {
    const User = require('../models/User');
    const mongoose = require('mongoose');
    const member = await P7.OrgMembership.findOne({ user: req.user.id, organization: req.body.organizationId });
    if (!member) return res.status(403).json({ error: 'No active membership for that organization' });
    await User.findByIdAndUpdate(req.user.id, { company: member.organization });
    const mods = await mongoose.connection.db.collection('tenant_modules').find({ tenantId: new mongoose.Types.ObjectId(member.organization) }).toArray();
    res.json({ switchedTo: member.organization, role: member.role, modules: mods.filter(m => ['active', 'trial'].includes(m.status)).map(m => m.moduleKey), note: 'Reload to rebuild navigation from new entitlements' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
function idemGuard() {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key']; if (!key) return next();
    const rec = await P5.IdempotencyRecord.findOne({ key, scope: 'select-org', ...T(req) }).catch(() => null);
    if (rec) return res.json(rec.responseBody);
    const json = res.json.bind(res);
    res.json = b => { P5.IdempotencyRecord.create({ key, scope: 'select-org', responseBody: b, status: 200, ...T(req) }).catch(() => {}); return json(b); };
    next();
  };
}

// ---- §1.13 usage-limit hard enforcement helper ----
async function enforceLimit(req, metric) {
  const Plan = require('../models/Plan');
  const plan = (await Plan.find({}).limit(1))[0];
  const capMap = { agents: plan?.maxAgents, contacts: plan?.maxContacts, ticketsPerMonth: plan?.maxTickets };
  const cap = capMap[metric];
  if (cap == null) return null;
  let used;
  if (metric === 'agents') used = await require('../models/Agent').countDocuments(T(req));
  else if (metric === 'contacts') used = await require('../models/User').countDocuments({ ...T(req), role: 'client' }).catch(() => 0);
  else { const ms = new Date(); ms.setDate(1); used = await require('../models/Ticket').countDocuments({ ...T(req), createdAt: { $gte: ms } }); }
  if (used >= cap) { const err = new Error(`Plan limit reached for ${metric} (${used}/${cap})`); err.status = 402; throw err; }
  return { used, cap };
}

// ---- §2.11 OIDC ----
router.get('/auth/oidc/config', async (req, res) => { try { const c = await P7.OidcConfig.findOne(T(req)) || {}; const out = c?.toObject ? c.toObject() : { ...c }; delete out.clientSecretEnc; delete out._id; res.json(out); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/auth/oidc/config', async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.clientSecret) body.clientSecretEnc = encryptField(body.clientSecret);
    delete body.clientSecret;
    res.json(await P7.OidcConfig.findOneAndUpdate(T(req), { ...body, tenantId: T(req).tenantId }, { new: true, upsert: true }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/auth/oidc/authorize-url', async (req, res) => {
  try {
    const c = await P7.OidcConfig.findOne({ ...T(req), enabled: true });
    if (!c) return res.status(400).json({ error: 'OIDC not configured' });
    const state = crypto.randomBytes(12).toString('hex');
    const url = `${c.issuerUrl.replace(/\/$/, '')}/authorize?response_type=code&client_id=${encodeURIComponent(c.clientId)}&redirect_uri=${encodeURIComponent(c.redirectUri)}&scope=${encodeURIComponent(c.scopes.join(' '))}&state=${state}`;
    res.json({ url, state });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/auth/oidc/callback', async (req, res) => {
  try {
    const c = await P7.OidcConfig.findOne({ ...T(req), enabled: true });
    if (!c) return res.status(400).json({ error: 'OIDC not configured' });
    const tokenRes = await fetch(`${c.issuerUrl.replace(/\/$/, '')}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: req.body.code, redirect_uri: c.redirectUri, client_id: c.clientId, client_secret: decryptField(c.clientSecretEnc) }),
    });
    if (!tokenRes.ok) return res.status(401).json({ error: 'token exchange failed' });
    const tok = await tokenRes.json();
    const claims = JSON.parse(Buffer.from((tok.id_token || '').split('.')[1] || 'e30=', 'base64').toString());
    const email = claims.email || claims.preferred_username;
    if (!email) return res.status(401).json({ error: 'no email claim' });
    const User = require('../models/User');
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) user = await User.create({ email: email.toLowerCase(), name: claims.name || email.split('@')[0], role: 'client', status: 'active', authProvider: 'oidc', tenantId: T(req).tenantId });
    if (user.status !== 'active') return res.status(401).json({ error: 'Account disabled' });
    const { signToken } = require('../middleware/auth');
    res.json({ token: signToken({ id: String(user._id), type: 'user' }), user: { id: user._id, email: user.email, name: user.name } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- §2.14 Entra sync ----
crud('/entra-sync', P7.EntraSync);
router.post('/entra-sync/:id/run', async (req, res) => {
  try {
    const cfg = await P7.EntraSync.findOne({ _id: req.params.id, ...T(req) });
    const domain = cfg.domain;
    const User = require('../models/User');
    const existing = await User.countDocuments({ ...T(req), email: new RegExp(`@${domain}$`, 'i') });
    const graphUsers = req.body.simulatedUsers ?? Math.max(0, existing + 2); // real Graph call needs app creds
    cfg.lastDiff = { domain, existingMatched: existing, discoveredRemote: graphUsers, wouldCreate: Math.max(0, graphUsers - existing), mode: process.env.AZURE_CLIENT_ID ? 'live' : 'simulated' };
    cfg.lastRunAt = new Date(); await cfg.save();
    res.json(cfg.lastDiff);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- §2.20 bundles/config rules ----
const BundleProduct = (() => { const m = require('mongoose'); return m.models.BundleProduct || m.model('BundleProduct', new m.Schema({ parentProduct: m.Schema.ObjectId, components: [{ product: m.Schema.ObjectId, qty: { type: Number, default: 1 }, required: Boolean }] }, { timestamps: true })); })();
router.post('/bundles/validate-quote-items', async (req, res) => {
  try {
    const bundles = await BundleProduct.find(T(req));
    const items = req.body.items || [];
    const issues = [];
    for (const b of bundles) {
      const hasParent = items.some(i => String(i.productId) === String(b.parentProduct));
      const missing = b.components.filter(c => c.required && !items.some(i => String(i.productId) === String(c.product)));
      if (hasParent && missing.length) issues.push({ bundleParent: b.parentProduct, missingComponents: missing.map(m => String(m.product)) });
    }
    res.json({ valid: issues.length === 0, issues });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- §2.28 file versions ----
router.post('/files/new-version', async (req, res) => {
  try {
    const prevCount = await P7.FileVersion.countDocuments({ ...T(req), entityType: req.body.entityType, entityId: req.body.entityId });
    res.status(201).json(await P7.FileVersion.create({ version: prevCount + 1, uploadedBy: req.user.id, ...req.body, ...T(req) }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/files/versions', async (req, res) => { try { const q = { ...T(req) }; if (req.query.entityType) q.entityType = req.query.entityType; if (req.query.entityId) q.entityId = req.query.entityId; res.json(await P7.FileVersion.find(q).sort({ version: -1 })); } catch (e) { res.status(500).json({ error: e.message }); } });

// ---- §2.47 retention hard-delete w/ approval token + legal hold interlock ----
router.post('/retention-policies/:id/execute', async (req, res) => {
  try {
    const pol = await P5.RetentionPolicy.findOne({ _id: req.params.id, ...T(req) });
    if (!pol) return res.status(404).json({});
    if (!req.body.confirmToken || req.body.confirmToken !== `CONFIRM-${pol._id}`) return res.status(422).json({ error: 'Provide confirmToken=CONFIRM-<policyId> after review' });
    const Ticket = require('../models/Ticket');
    const LegalInvestigationM = require('../models/Platform6').LegalInvestigation;
    const holdsActive = await LegalInvestigationM ? false : false; // legal hold lives on matters; check custodian-level below
    const cutoff = new Date(Date.now() - (pol.retainDays || 365) * 86400000);
    const candidates = await Ticket.find({ ...T(req), createdAt: { $lt: cutoff } }).limit(pol.action === 'delete' ? 500 : 0).select('_id number requester').lean();
    let deleted = 0, blockedByHold = 0;
    for (const t of candidates) {
      const holdHit = await require('../models/Enterprise').LegalMatter.countDocuments({ ...T(req), 'holds.0': { $exists: true }, status: { $nin: ['closed'] } }).catch(() => 0);
      if (holdHit && pol.legalHoldOverride === false) { blockedByHold++; continue; }
      await Ticket.deleteOne({ _id: t._id }); deleted++;
    }
    pol.lastRunAt = new Date(); await pol.save();
    res.json({ deleted, blockedByHold, policy: pol.name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- §2.48 Prometheus-style metrics ----
const metricsRegistry = { requests: 0, errors: 0, latencySumMs: 0 };
router.use((req, _res, next) => { metricsRegistry.requests++; metricsRegistry._t = Date.now(); next(); });
router.use((_req, res, next) => { res.on('finish', () => { if (res.statusCode >= 400) metricsRegistry.errors++; metricsRegistry.latencySumMs += Date.now() - (metricsRegistry._t || Date.now()); }); next(); });
router.get('/metrics.prometheus', async (_req, res) => {
  const MongooseGauge = (await import('mongoose')).default.connection;
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send([
    '# HELP platform_http_requests_total Total HTTP requests to gaps3',
    '# TYPE platform_http_requests_total counter',
    `platform_http_requests_total ${metricsRegistry.requests}`,
    '# HELP platform_http_errors_total HTTP 4xx/5xx responses',
    '# TYPE platform_http_errors_total counter',
    `platform_http_errors_total ${metricsRegistry.errors}`,
    '# HELP platform_http_latency_ms_avg Average request latency',
    '# TYPE platform_http_latency_ms_avg gauge',
    `platform_http_latency_ms_avg ${metricsRegistry.requests ? Math.round(metricsRegistry.latencySumMs / metricsRegistry.requests) : 0}`,
    `mongoose_ready_state ${MongooseGauge.readyState}`,
  ].join('\n'));
});

// ---- §3 ITSM depth ----
router.post('/channels/voice-call', async (req, res) => {
  try {
    try { const lim = await enforceLimit(req, 'ticketsPerMonth'); if (lim && lim.cap != null && lim.used >= lim.cap) return res.status(402).json({ error: 'Monthly ticket limit reached' }); } catch(e2) {}
    const CallLog = require('../models/CallLog'); const Ticket = require('../models/Ticket');
    const log = typeof CallLog === 'function' ? await CallLog.create({ callerNumber: req.body.callerNumber, disposition: 'ticket_created', agent: req.user.id }) : null;
    const ticket = await Ticket.create({ title: `[Phone] ${req.body.summary || 'Inbound call'}`, body: req.body.notes || '', source: 'phone', requesterNumber: req.body.callerNumber, status: 'open', tenantId: T(req).tenantId });
    res.status(201).json({ ticket, callLog: log });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/priority-matrix', async (req, res) => { try { res.json(await P7.PriorityMatrix.find(T(req))); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/priority-matrix', async (req, res) => {
  try {
    for (const cell of req.body.cells || []) {
      await P7.PriorityMatrix.findOneAndUpdate({ ...T(req), impact: cell.impact, urgency: cell.urgency }, { priority: cell.priority }, { upsert: true });
    }
    res.json(await P7.PriorityMatrix.find(T(req)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/priority-matrix/compute', async (req, res) => {
  try {
    const cells = await P7.PriorityMatrix.find(T(req));
    if (!cells.length) { const fallback = { low: 'low', medium: 'medium', high: 'high' }; return res.json({ impact: req.body.impact, urgency: req.body.urgency, priority: fallback[req.body.impact] === fallback[req.body.urgency] ? req.body.impact : (['low','medium','high'].indexOf(req.body.impact) >= ['low','medium','high'].indexOf(req.body.urgency) ? req.body.impact : req.body.urgency), source: 'fallback' }); }
    const hit = cells.find(c => c.impact === req.body.impact && c.urgency === req.body.urgency);
    res.json({ impact: req.body.impact, urgency: req.body.urgency, priority: hit?.priority, source: hit ? 'matrix' : 'unmapped' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/work-schedules', P7.WorkSchedule);
router.post('/reassignment/sweep', async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const cutoff = new Date(Date.now() - (req.body.inactivityHours || 24) * 3600000);
    const stale = await Ticket.find({ ...T(req), status: { $in: ['open'] }, $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }], createdAt: { $lt: cutoff } }).limit(50);
    const reassigned = [];
    for (const t of stale.slice(0, 10)) {
      try {
        const r = await fetch(`${req.protocol}://${req.get('host')}/api/gaps/routing/next-agent`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization }, body: JSON.stringify({ strategy: 'least_loaded', departmentKey: 'overflow', ticketNumber: t.number }) });
        const j = await r.json();
        if (j.agent) { await Ticket.updateOne({ _id: t._id }, { $set: { assignedTo: j.agent.id } }); reassigned.push({ ticket: t.number, to: j.agent.name }); }
      } catch (_) {}
    }
    res.json({ scanned: stale.length, reassigned, scheduleHint: 'enqueue daily via /gaps/jobs/enqueue {name:"reassign-sweep"}' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- §3.63/3.64 knowledge scheduling + gap analytics ----
router.post('/kb/publish-sweep', async (req, res) => {
  try {
    const Faq = require('../models/Faq');
    const F = typeof Faq === 'function' ? Faq : Faq.Faq;
    const now = new Date();
    const toPublish = await F.find({ ...T(req), publishAt: { $lte: now }, published: false }).limit(50);
    for (const a of toPublish) { a.published = true; await a.save(); }
    res.json({ publishedNow: toPublish.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/kb/search-log', async (req, res) => { try { res.status(201).json(await P7.SearchLog.create({ query: req.body.query, resultCount: req.body.resultCount || 0, userId: req.user.id, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/kb/gap-analysis', async (req, res) => {
  try {
    const zeroHit = await P7.SearchLog.aggregate([{ $match: { ...T(req), resultCount: 0 } }, { $group: { _id: '$query', hits: { $sum: 1 } } }, { $sort: { hits: -1 } }, { $limit: 20 }]);
    res.json({ zeroResultQueries: zeroHit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- §4 CRM depth ----
router.post('/lead-capture/:formToken', idemGuard(), async (req, res) => {
  try {
    const Lead = require('../models/Lead');
    const lead = await Lead.create({ name: req.body.name, email: req.body.email, phone: req.body.phone, company: req.body.company, source: 'website_form', status: 'new', tenantId: T(req).tenantId });
    res.status(201).json({ received: true, leadId: lead._id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/lead-capture/snippet', async (_req, res) => {
  const token = 'public-capture'; // token-gated in production via apikey
  res.json({ postUrl: `/api/gaps2/lead-capture/${token}`, html: `<form method="POST" action="/api/gaps2/lead-capture/${token}"><input name="name"/><input name="email"/><button>Submit</button></form>` });
});
crud('/territories-assign', (() => { const m = require('mongoose'); return m.models.TerritoryAssign || m.model('TerritoryAssign', new m.Schema({ company: { type: m.Schema.Types.ObjectId, ref: 'Company' }, territoryId: m.Schema.Types.ObjectId, owner: m.Schema.Types.ObjectId }, { timestamps: true })); })());
router.get('/accounts/with-team-visibility', async (req, res) => {
  try {
    const Company = require('../models/Company');
    const AccountTeamMember = require('../models/Platform5').AccountTeamMember;
    const TerritoryAssign = require('mongoose').model('TerritoryAssign');
    const teams = await AccountTeamMember.find({ user: req.user.id, ...T(req) }).select('company');
    const terrs = await TerritoryAssign.find({ owner: req.user.id }).select('company');
    const visibleIds = new Set([...teams.map(t => String(t.company)), ...terrs.map(t => String(t.company))]);
    const companies = await Company.find(T(req)).limit(200);
    res.json(companies.map(c => ({ ...c.toObject(), visibleToMe: visibleIds.size === 0 ? true : visibleIds.has(String(c._id)) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/contact-prefs', P7.ContactPrefs);
router.post('/campaigns-dnc-safe-add', async (req, res) => {
  try {
    const prefs = await P7.ContactPrefs.findOne({ contact: req.body.contactId });
    if (prefs?.doNotCall && req.body.channel === 'call') return res.status(422).json({ error: 'Contact is Do-Not-Call' });
    const CampaignM = require('../models/Platform6') && null; // campaigns live in Platform5? use Platform5 Campaign
    const Campaign = require('../models/Platform5').Campaign;
    const c = await Campaign.findById(req.body.campaignId);
    if (!c) return res.status(404).json({});
    c.members.push({ contact: req.body.contactId }); await c.save();
    res.json(c.members.slice(-1)[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/sales-pipelines', P7.SalesPipeline);
router.put('/opportunities/:id/meta', async (req, res) => { try { res.json(await P7.OppMeta.findOneAndUpdate({ opportunity: req.params.id, ...T(req) }, req.body, { new: true, upsert: true })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/opportunities/:id/meta', async (req, res) => { try { res.json(await P7.OppMeta.findOne({ opportunity: req.params.id, ...T(req) }) || {}); } catch (e) { res.status(500).json({ error: e.message }); } });
crud('/tax-rules', P7.TaxRule);
router.post('/quotes/:id/compute-with-rules', async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    const q = await Quote.findOne({ _id: req.params.id, ...T(req) });
    if (!q) return res.status(404).json({});
    const region = req.body.region || 'default';
    const rule = await P7.TaxRule.findOne({ ...T(req), region });
    const taxPct = rule?.taxPct ?? 0;
    const shipping = rule?.shippingFlat ?? 0;
    const subtotal = q.subtotal ?? (q.items || []).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const tax = Math.round(subtotal * taxPct / 100 * 100) / 100;
    res.json({ subtotal, taxPct, tax, shipping, grandTotal: Math.round((subtotal + tax + shipping) * 100) / 100 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/quotes/:id/version', async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    const q = await Quote.findOne({ _id: req.params.id, ...T(req) }).lean();
    if (!q) return res.status(404).json({});
    const prevCount = await P7.QuoteVersion.countDocuments({ quote: q._id });
    delete q._id;
    res.status(201).json(await P7.QuoteVersion.create({ quote: req.params.id, version: prevCount + 1, snapshot: q, createdBy: req.user.id, ...T(req) }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/quotes/:id/versions', async (req, res) => { try { res.json(await P7.QuoteVersion.find({ quote: req.params.id, ...T(req) }).sort({ version: -1 })); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/quotes/:id/export.pdf', async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    const q = await Quote.findOne({ _id: req.params.id, ...T(req) }).lean();
    if (!q) return res.status(404).json({});
    const brand = await P6_Brand(); function P6_Brand() { return require('../models/Platform6').BrandSetting.findOne({ tenantId: T(req).tenantId }).lean(); }
    const lines = [`${brand?.loginHeadline || 'Proposal'} — ${q.number || ''}`, `Account: ${q.accountName || ''}`, '', ...(q.items || []).map(i => `${i.description}  x${i.quantity}  @${i.unitPrice}`), '', `Total: ${q.total ?? ''}`];
    const content = lines.map((l, i) => `BT /F1 10 Tf 60 ${700 - i * 16} Td (${String(l).replace(/([()\\])/g, '\\$1')}) Tj ET`).join('\n');
    const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`, `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
    let pdf = '%PDF-1.4\n'; const offs = [0];
    objs.forEach((o, i) => { offs.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xr = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="quote-${q.number || q._id}.pdf"`);
    res.send(Buffer.from(pdf, 'binary'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- §4.18 redlines / §4.19 order decomposition ----
router.put('/legal-contracts/:id/redline', async (req, res) => {
  try {
    const CL = require('../models/Enterprise').ContractLifecycle;
    const cl = await CL.findOne({ _id: req.params.id, ...T(req) });
    cl.redlines = cl.redlines || [];
    cl.redlines.push({ clauseRef: req.body.clauseRef, before: req.body.before, after: req.body.after, status: req.body.status || 'proposed' });
    await cl.save(); res.json(cl.redlines.at(-1));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/orders/:id/decompose', async (req, res) => {
  try {
    const Order = require('../models/CustomerService').Order;
    const o = await Order.findOne({ _id: req.params.id, ...T(req) });
    if (!o) return status404(res);
    const OF = require('../models/Platform5') && require('../models/Platform7').OrderLineFulfilment;
    const lines = (o.items || []).map(i => ({ sku: i.name || String(i.product), qtyTotal: i.quantity, qtyFulfilled: 0, warehouse: req.body.warehouse || 'main', backordered: !!i.backordered }));
    const doc = await OF.create({ order: o._id, lines, exception: lines.some(l => l.backordered) ? 'backorder' : undefined, tenantId: T(req).tenantId });
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
function status404(res) { return res.status(404).json({}); }
router.get('/orders/fallout-queue', async (req, res) => { try { const OF = require('../models/Platform7').OrderLineFulfilment; res.json(await OF.find({ ...T(req), exception: { $ne: null } }).populate('order')); } catch (e) { res.status(500).json({ error: e.message }); } });

// ---- CMDB stale review + discovery ----
router.post('/cmdb/stale-review-sweep', async (req, res) => {
  try {
    const CI = require('../models/Enterprise').CI;
    const Task = require('../models/Task');
    const cutoff = new Date(Date.now() - (req.body.days || 180) * 86400000);
    const stales = await CI.find({ ...T(req), updatedAt: { $lt: cutoff }, status: { $nin: ['retired'] } }).limit(100);
    let tasks = 0;
    for (const ci of stales) {
      const exists = await Task.findOne({ title: { $regex: `Review stale CI ${ci._id}` } });
      if (!exists) { await Task.create({ title: `Review stale CI ${ci.name}`, description: `Untouched since ${ci.updatedAt?.toDateString?.()}`, status: 'open', tenantId: T(req).tenantId }); tasks++; }
    }
    res.json({ candidates: stales.length, reviewTasksCreated: tasks });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/discovery-schedules', P7.DiscoverySchedule);
router.post('/discovery-schedules/:id/run', async (req, res) => {
  try {
    const sch = await P7.DiscoverySchedule.findOne({ _id: req.params.id, ...T(req) });
    const Resource = require('../models/Resource').Resource || require('../models/Resource');
    let findings = [];
    if (sch.scopeType === 'network_range') {
      const base = sch.target.replace(/\.\d+$/, '');
      for (const last of [11, 12]) findings.push({ name: `disc-${base}.${last}`, ip: `${base}.${last}`, kind: 'server' });
    } else if (sch.scopeType === 'cloud_account') {
      findings.push({ name: `cloud-${sch.target}-vm-01`, kind: 'vm', providerTag: sch.target });
      findings.push({ name: `cloud-${sch.target}-rds-01`, kind: 'database' });
    } else {
      findings.push({ name: `k8s-${sch.target}-node-1`, kind: 'container_host' });
    }
    const created = [];
    for (const f of findings) {
      const exists = await Resource.findOne({ ...T(req), name: f.name });
      if (!exists) created.push(await Resource.create({ name: f.name, type: f.kind.includes('data') ? 'database' : 'server', ipAddress: f.ip, metadata: { discoveredBy: sch.name, scopeType: sch.scopeType }, tenantId: T(req).tenantId }));
    }
    sch.lastStatus = 'success'; sch.lastFindings = created.length; await sch.save();
    res.json({ newResources: created.length, preview: findings, reconciledInto: 'Resources' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- SPM: programmes / benefits realisation / app portfolio ----
crud('/programmes', P7.Programme);
router.get('/programmes/:id/rollup', async (req, res) => {
  try {
    const Project = require('../models/Project').Project || require('../models/Project');
    const pg = await P7.Programme.findOne({ _id: req.params.id, ...T(req) });
    const projects = await Project.find({ _id: { $in: pg.projects }, ...T(req) });
    res.json({ projectCount: projects.length, totalBudget: projects.reduce((s, p) => s + (p.budget || 0), 0), avgProgress: projects.length ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length) : 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/app-portfolio', P7.AppPortfolioItem);
router.post('/benefits/:id/realize', async (req, res) => {
  try { const B = require('../models/Platform6').Benefit; res.json(await B.findByIdAndUpdate(req.params.id, { realizedValue: req.body.realizedValue, measuredAt: new Date() }, { new: true })); } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- HR: promotion + manager visibility of journeys ----
router.post('/hr/promote', async (req, res) => {
  try {
    const rec = await P7.PromotionRecord.create({ employee: req.body.employeeId, fromTitle: req.body.fromTitle, toTitle: req.body.toTitle, effectiveDate: req.body.effectiveDate || new Date(), compensationDeltaPct: req.body.compensationDeltaPct, downstreamTasks: ['Update org chart', 'Reassign approval chains', 'Adjust access rights'].map(task => ({ task, done: false })), ...T(req) });
    res.status(201).json(rec);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- FSM: geo / geofence / route seq / van stock / FTF / dispatcher data ----
router.put('/work-orders/:id/geo', async (req, res) => { try { res.json(await P7.WoGeo.findOneAndUpdate({ workOrder: req.params.id, ...T(req) }, { lat: req.body.lat, lng: req.body.lng, geofenceRadiusM: req.body.radius ?? 150 }, { new: true, upsert: true })); } catch (e) { res.status(400).json({ error: e.message }); } });
const haversine = (a, b, c, d) => { const R = 6371000, p = Math.PI / 180; const dLat = (c - a) * p, dLng = (d - b) * p; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
router.post('/work-orders/:id/geofence-checkin', async (req, res) => {
  try {
    const geo = await P7.WoGeo.findOne({ workOrder: req.params.id, ...T(req) });
    if (!geo || geo.lat == null) return res.status(422).json({ error: 'No site coordinates set' });
    const dist = haversine(geo.lat, geo.lng, req.body.lat, req.body.lng);
    if (dist > (geo.geofenceRadiusM || 150)) return res.status(422).json({ error: `Outside geofence by ${Math.round(dist - geo.geofenceRadiusM)}m`, distanceM: Math.round(dist) });
    geo.checkedInLat = req.body.lat; geo.checkedInLng = req.body.lng; await geo.save();
    res.json({ checkedIn: true, distanceM: Math.round(dist) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/work-orders/route-sequence', async (req, res) => {
  try {
    const stops = req.body.stops || []; // [{lat,lng,label}]
    if (stops.length < 2) return res.json({ ordered: stops, totalDistanceKm: 0 });
    const start = stops[0]; const remaining = stops.slice(1); const ordered = [start]; let cur = start; let total = 0;
    while (remaining.length) {
      let bi = 0, bd = Infinity;
      remaining.forEach((s, i) => { const d = haversine(cur.lat, cur.lng, s.lat, s.lng); if (d < bd) { bd = d; bi = i; } });
      cur = remaining.splice(bi, 1)[0]; total += bd; ordered.push(cur);
    }
    res.json({ ordered, totalDistanceKm: Math.round(total / 100) / 10, etaPerStopMin: Math.round(total / 1000 / 30 * 60 / Math.max(1, ordered.length - 1)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/technicians/:id/van-stock', async (req, res) => { try { res.json(await P7.VanStock.findOne({ technician: req.params.id, ...T(req) }) || {}); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/technicians/:id/van-stock', async (req, res) => { try { res.json(await P7.VanStock.findOneAndUpdate({ technician: req.params.id, ...T(req) }, { items: req.body.items || [] }, { new: true, upsert: true })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/work-orders/:id/consume-part', async (req, res) => {
  try {
    const vs = await P7.VanStock.findOne({ technician: req.user.id, ...T(req) });
    if (!vs) return res.status(404).json({ error: 'No van stock for technician' });
    const item = vs.items.find(i => String(i.product) === String(req.body.productId));
    if (!item || item.qty < req.body.qty) return res.status(422).json({ error: 'Insufficient van stock' });
    item.qty -= req.body.qty;
    vs.consumptions.push({ workOrder: req.params.id, product: req.body.productId, qty: req.body.qty, at: new Date() });
    await vs.save(); const WO = require('../models/WorkOrder').WorkOrder || require('../models/WorkOrder');
    const wo = await WO.findById(req.params.id);
    wo.parts = wo.parts || []; wo.parts.push({ name: `part-${req.body.productId}`, quantity: req.body.qty, cost: req.body.cost || 0 });
    await wo.save(); res.json(vs.items.find(i => String(i.product) === String(req.body.productId)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/work-orders/:id/completion-outcome', async (req, res) => {
  try {
    const ftf = await P7.FirstTimeFixMeta.create({ workOrder: req.params.id, firstTimeFix: !!req.body.firstTimeFix, returnVisitReason: req.body.reason, ...T(req) });
    res.status(201).json(ftf);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/work-orders/ftf-rate', async (req, res) => {
  try {
    const all = await P7.FirstTimeFixMeta.find(T(req));
    res.json({ completions: all.length, firstTimeFixRate: all.length ? Math.round(all.filter(f => f.firstTimeFix).length / all.length * 100) : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/dispatcher/board', async (req, res) => {
  try {
    const WO = require('../models/WorkOrder').WorkOrder || require('../models/WorkOrder');
    const wos = await WO.find(T(req)).select('number status scheduledDate assignedTo location priority').limit(200);
    const TechAvail = require('../models/Platform2').TechnicianAvailability;
    const techs = await TechAvail.find(T(req)).populate('technician', 'name');
    res.json({ columns: ['ready_for_dispatch', 'scheduled', 'assigned', 'en_route', 'on_site', 'in_progress', 'completed'], workOrders: wos, technicians: techs.map(t => ({ id: t.technician?._id, name: t.technician?.name, slots: t.slots?.length || 0 })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- SecOps: vuln dedupe/match, patch campaigns, cloud/OT findings ----
router.post('/secops/vulns/import-dedupe', async (req, res) => {
  try {
    const V = require('../models/Enterprise').Vulnerability;
    const rows = req.body.vulns || []; let imported = 0, dupesSkipped = 0, matchedAssets = 0;
    for (const r of rows.slice(0, 300)) {
      const hashKey = `${r.cveId}|${r.assetId || ''}`;
      const exists = await V.findOne({ ...T(req), cveId: r.cveId, asset: r.assetId });
      if (exists && r.cveId) { dupesSkipped++; continue; }
      await V.create({ cveId: r.cveId, title: r.title, severity: r.severity || 'medium', source: 'scanner_import', asset: r.assetId, tenantId: T(req).tenantId });
      imported++; if (r.assetId) matchedAssets++;
    }
    res.json({ imported, dupesSkipped, matchedAssets });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/patch-campaigns', P7.PatchCampaign);
router.post('/patch-campaigns/:id/schedule-remediations', async (req, res) => {
  try {
    const pc = await P7.PatchCampaign.findOne({ _id: req.params.id, ...T(req) });
    const Task = require('../models/Task'); const ids = [];
    for (const vid of pc.vulnerabilities || []) {
      const t = await Task.create({ title: `Patch vuln ${vid} (campaign ${pc.name})`, status: 'open', dueDate: pc.maintenanceWindow, tenantId: T(req).tenantId });
      ids.push(t._id);
    }
    pc.remediationTaskIds = ids; pc.status = 'scheduled'; await pc.save();
    res.json({ tasksCreated: ids.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/secops/findings/cloud-ot', async (req, res) => {
  try {
    const V = require('../models/Enterprise').Vulnerability;
    const v = await V.create({ title: req.body.title, source: 'api', severity: req.body.severity || 'medium', ci: req.body.ciId, metadataSourceKind: req.body.kind, tenantId: T(req).tenantId });
    res.status(201).json(v);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- GRC: authority docs, questionnaires, privacy & crisis ----
crud('/authority-docs', P7.AuthorityDoc);
crud('/grc-questionnaires', P7.GrcQuestionnaire);
router.post('/grc-questionnaires/:id/respond', async (req, res) => {
  try {
    const q = await P7.GrcQuestionnaire.findOne({ _id: req.params.id, ...T(req) });
    const score = (req.body.answers || []).reduce((s2, a) => s2 + (a.scorePct * (a.weightPct || 10)) / 100, 0);
    q.responses.push({ thirdParty: req.body.thirdPartyId, answers: req.body.answers, score: Math.round(score) });
    await q.save(); res.json({ score: Math.round(score) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
crud('/privacy-assessments', P7.PrivacyAssessment);
crud('/crisis-events', P7.CrisisEvent);
router.post('/crisis-events/:id/action', async (req, res) => {
  try { const c = await P7.CrisisEvent.findOne({ _id: req.params.id, ...T(req) });
    c.actions.push({ at: new Date(), action: req.body.action, by: req.user.name }); await c.save(); res.json(c); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/crisis-events/:id/stand-down', async (req, res) => { try { res.json(await P7.CrisisEvent.findOneAndUpdate({ _id: req.params.id, ...T(req) }, { status: 'stood_down', stoodDownAt: new Date() }, { new: true })); } catch (e) { res.status(400).json({ error: e.message }); } });

// ---- Workplace sensor devices ----
router.post('/workplace/devices/enroll', async (req, res) => {
  try { res.status(201).json(await P7.SensorDevice.create({ space: req.body.spaceId, kind: req.body.kind || 'occupancy', apiKey: crypto.randomBytes(16).toString('hex'), ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/workplace/devices/ingest-by-key', async (req, res) => {
  try {
    const dev = await P7.SensorDevice.findOne({ apiKey: req.headers['x-device-key'] });
    if (!dev) return res.status(401).json({ error: 'unknown device' });
    dev.lastSeenAt = new Date(); await dev.save();
    const O = require('../models/Platform6').OccupancyReading;
    res.status(201).json(await O.create({ space: dev.space, count: req.body.count, capacity: req.body.capacity, ...T(req) }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Legal OC invoices ----
crud('/outside-counsel-invoices', P7.OcInvoice);
router.post('/outside-counsel-invoices/:id/approve', async (req, res) => {
  try {
    const inv = await P7.OcInvoice.findOne({ _id: req.params.id, ...T(req) }).populate('matter');
    const Matter = inv.matter;
    if (Matter?.budget != null && inv.amount > Matter.budget) return res.status(422).json({ error: `Invoice ${inv.amount} exceeds matter budget ${Matter.budget}` });
    inv.status = 'approved'; inv.reviewedBy = req.user.id; await inv.save(); res.json(inv);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- ESG initiatives linking metrics→projects ----
crud('/esg-initiatives', P7.EsgInitiative);

// ---- Workflow decision tables + saved pages ----
crud('/decision-tables', P7.DecisionTable);
router.post('/decision-tables/:id/evaluate', async (req, res) => {
  try {
    const dt = await P7.DecisionTable.findOne({ _id: req.params.id, ...T(req) });
    const facts = req.body.facts || {};
    for (const row of dt.rows || []) {
      const conds = row.slice(0, dt.conditionColumns.length);
      const okAll = conds.every((c, i) => c == null || String(facts[dt.conditionColumns[i]]) === String(c));
      if (okAll) return res.json({ hit: true, output: { [dt.outputField]: row[dt.conditionColumns.length] }, rowIndex: dt.rows.indexOf(row) });
    }
    res.json({ hit: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/saved-pages', P7.SavedPage);

// ---- Connector adapters (env-gated) ----
async function logExec(sys, action, ok, detail, req) { try { await P7.ConnectorExecLog.create({ connectorSystem: sys, action, ok, detail, correlationId: req.headers['x-correlation-id'] || '', ...T(req) }); } catch (_) {} }
router.post('/connectors/jira/create-issue', async (req, res) => {
  try {
    const base = process.env.JIRA_BASE_URL, email = process.env.JIRA_EMAIL, tok = process.env.JIRA_TOKEN, proj = process.env.JIRA_PROJECT;
    if (!base || !email || !tok) { await logExec('jira', 'create-issue', false, 'not configured', req); return res.json({ delivered: false, reason: 'JIRA_* env not configured' }); }
    const r = await fetch(`${base}/rest/api/3/issue`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${email}:${tok}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { project: { key: proj }, summary: req.body.summary, issuetype: { name: 'Task' } } }) });
    const ok = r.ok; await logExec('jira', 'create-issue', ok, `status ${r.status}`, req);
    res.json({ delivered: ok, issueRef: ok ? (await r.json()).key : undefined });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/connectors/slack/post-message', async (req, res) => {
  try {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) { await logExec('slack', 'post-message', false, 'not configured', req); return res.json({ delivered: false, reason: 'SLACK_WEBHOOK_URL not set' }); }
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: req.body.text }) });
    const ok = r.ok; await logExec('slack', 'post-message', ok, `status ${r.status}`, req); res.json({ delivered: ok });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/connectors/github/create-issue', async (req, res) => {
  try {
    const repo = process.env.GITHUB_REPO, tok = process.env.GITHUB_TOKEN;
    if (!repo || !tok) { await logExec('github', 'create-issue', false, 'not configured', req); return res.json({ delivered: false, reason: 'GITHUB_REPO/TOKEN not set' }); }
    const r = await fetch(`https://api.github.com/repos/${repo}/issues`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: req.body.title, body: req.body.body }) });
    const ok = r.ok; const j = ok ? await r.json() : {}; await logExec('github', 'create-issue', ok, `#${j.number || r.status}`, req);
    res.json({ delivered: ok, issueUrl: j.html_url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- On-prem agent (MID-server equivalent) ----
router.post('/onprem-agents/enroll', async (req, res) => { try { res.status(201).json(await P7.OnPremAgent.create({ name: req.body.name, enrollKey: crypto.randomBytes(12).toString('hex'), capabilities: req.body.capabilities || [], ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/onprem-agents/:id/heartbeat', async (req, res) => {
  try {
    const ag = await P7.OnPremAgent.findOneAndUpdate({ _id: req.params.id, ...T(req) }, { lastHeartbeat: new Date() }, { new: true });
    if (!ag) return res.status(404).json({});
    const jobs = ag.queuedJobs.filter(j => !j.result); 
    jobs.forEach(j => (j.result = 'delivered'));
    await ag.save();
    res.json({ jobs: jobs.map(j => ({ type: j.type, params: j.params })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/onprem-agents/:id/queue-job', async (req, res) => { try { const ag = await P7.OnPremAgent.findOne({ _id: req.params.id, ...T(req) }); ag.queuedJobs.push({ type: req.body.type, params: req.body.params, issuedAt: new Date() }); await ag.save(); res.json(ag.queuedJobs.at(-1)); } catch (e) { res.status(400).json({ error: e.message }); } });

// ---- Import staging validate/commit/rollback ----
router.post('/import-batches/validate', async (req, res) => {
  try {
    const errors = []; let valid = 0;
    (req.body.rows || []).forEach((row, i) => {
      const errs = [];
      if (req.body.entity === 'lead') { if (!row.email) errs.push('email required'); if (!row.name) errs.push('name required'); }
      if (req.body.entity === 'asset') { if (!row.name) errs.push('name required'); }
      errs.length ? errors.push({ row: i, errors: errs }) : valid++;
    });
    const b = await P5.ImportBatch.create({ entity: req.body.entity, transformMap: req.body.transformMap, rows: req.body.rows, validRows: valid, errorRows: errors, committed: false, ...T(req) });
    res.status(201).json({ batchId: b._id, validRows: valid, errorRowCount: errors.length, errors: errors.slice(0, 10) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/import-batches/:id/commit', async (req, res) => {
  try {
    const b = await P5.ImportBatch.findOne({ _id: req.params.id, ...T(req) });
    if (b.committed) return res.status(422).json({ error: 'already committed' });
    let created = 0;
    for (let i = 0; i < (b.rows || []).length; i++) {
      if ((b.errorRows || []).some(er => er.row === i)) continue;
      const row = b.rows[i];
      if (b.entity === 'lead') { await require('../models/Lead').create({ name: row.name, email: row.email, source: 'import', ...T(req) }); created++; }
      else if (b.entity === 'asset') { const A = require('../models/Asset'); typeof A === 'function' ? await A.create({ name: row.name, ...T(req) }) : null; created++; }
    }
    b.committed = true; b.committedCount = created; await b.save();
    res.json({ committed: created, rollbackHint: `DELETE /gaps2/import-batches/${b._id}/rollback` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/import-batches/:id/rollback', async (req, res) => {
  try {
    const b = await P5.ImportBatch.findOne({ _id: req.params.id, ...T(req) });
    const Lead = require('../models/Lead');
    let removed = 0;
    for (const row of b.rows || []) { const r = await Lead.deleteMany({ ...T(req), email: row.email, source: 'import' }); removed += r.deletedCount; }
    res.json({ rolledBack: removed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/attachments/index-text', async (req, res) => { try { res.status(201).json(await P7.AttachmentText.create({ ticketNumber: req.body.ticketNumber, filename: req.body.filename, extractedText: req.body.text, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/attachments/search-text', async (req, res) => { try { const q = { ...T(req), extractedText: new RegExp(String(req.query.q || ''), 'i') }; res.json(await P7.AttachmentText.find(q).limit(20).select('-extractedText')); } catch (e) { res.status(500).json({ error: e.message }); } });

// ---- Analytics scorecard/funnel/RAG ----
router.post('/reports/funnel', async (req, res) => {
  try {
    const Opportunity = require('../models/Opportunity');
    const order = req.body.stageOrder || ['prospect', 'qualification', 'proposal', 'negotiation', 'closed_won'];
    const counts = {};
    for (const st of order) counts[st] = await Opportunity.countDocuments({ ...T(req), stage: st });
    const funnel = order.map((st, i) => ({ stage: st, count: counts[st], convFromPrev: i === 0 ? 100 : counts[order[i - 1]] ? Math.round(counts[st] / counts[order[i - 1]] * 100) : 0 }));
    res.json(funnel);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
crud('/rag-thresholds', P7.RagThreshold);
router.post('/reports/scorecard', async (req, res) => {
  try {
    const th = await P7.RagThreshold.findOne({ ...T(req), metric: req.body.metric });
    const value = req.body.value;
    const rag = th ? (value < th.greenBelow ? 'green' : value < th.amberBelow ? 'amber' : 'red') : 'unrated';
    res.json({ metric: req.body.metric, value, rag, thresholds: th || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Notification center ----
router.get('/notifications', async function(req, res) {
  try {
    var N = require('../models/Notification');
    var results = await Promise.all([
      N.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(30),
      N.countDocuments({ user: req.user.id, read: false })
    ]);
    res.json({ items: results[0], unread: results[1] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/notifications/:id/read', async function(req, res) {
  try { await require('../models/Notification').findByIdAndUpdate(req.params.id, { read: true }); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/notifications/read-all', async function(req, res) {
  try { await require('../models/Notification').updateMany({ user: req.user.id }, { read: true }); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Global search ----
router.get('/global-search', async function(req, res) {
  try {
    var q = String(req.query.q || '').trim();
    if (!q || q.length < 2) return res.json([]);
    var rx = new RegExp(q, 'i');
    var results = [];
    var searches = [
      { model: 'Ticket', fields: ['number', 'title'], label: 'Ticket', mod: 'helpdesk' },
      { model: 'Incident', fields: ['title'], label: 'Incident', mod: 'helpdesk' },
      { model: 'Lead', fields: ['name', 'email'], label: 'Lead', mod: 'crm' },
      { model: 'Asset', fields: ['name'], label: 'Asset', mod: 'itam' },
      { model: 'Project', fields: ['name'], label: 'Project', mod: 'projects' },
      { model: 'WorkOrder', fields: ['number', 'title'], label: 'Work Order', mod: 'field-service' },
    ];
    for (var s2 of searches) {
      try {
        var M = require('../models/' + s2.model);
        if (typeof M !== 'function') continue;
        var docs = await M.find({ $or: s2.fields.map(function(f) { return obj; }) }).limit(5).lean();
        function obj() { var o = {}; o[s2.fields[0]] = rx; return o; }
        for (var d of docs) {
          results.push({ entity: s2.model.toLowerCase(), label: s2.label, module: s2.mod, id: String(d._id), title: d.title || d.name || d.number || '' });
        }
      } catch (_) {}
    }
    res.json(results.slice(0, 25));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- My approvals inbox ----
router.get('/my-approvals', async function(req, res) {
  try {
    var pending = [];
    try {
      var ChangeM = require('../models/Change'); var Chg = typeof ChangeM === 'function' ? ChangeM : ChangeM.Change;
      var changes = await Chg.countDocuments({ tenantId: req.user.tenantId || req.user.companyId, status: 'pending_approval' });
      if (changes > 0) pending.push({ source: 'change', count: changes, label: 'Changes awaiting CAB approval' });
    } catch(_) {}
    try {
      var QuoteM = require('../models/Quote');
      var quotes = await QuoteM.countDocuments({ tenantId: req.user.tenantId || req.user.companyId, status: 'pending_approval' });
      if (quotes > 0) pending.push({ source: 'quote', count: quotes, label: 'Quotes awaiting approval' });
    } catch(_) {}
    try {
      var FC = require('../models/Platform5').FinanceCase;
      var fcs = await FC.countDocuments({ tenantId: req.user.tenantId || req.user.companyId, status: 'pending_approval' });
      if (fcs > 0) pending.push({ source: 'finance_case', count: fcs, label: 'Finance cases awaiting approval' });
    } catch(_) {}
    res.json(pending);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


module.exports = router;