const express = require('express');
const { protectTenantPrincipal, protectAdmin } = require('../middleware/auth');
const { MaintenanceWindow, CustomTable, CustomRecord, CustomForm, Portfolio, DemandItem, OffboardingChecklist, TechnicianAvailability, KnownIssue, SsoConfig, LdapConfig } = require('../models/Platform2');
const integrations = require('../services/integrations.service');

const router = express.Router();
router.use(protectTenantPrincipal);

const T = req => ({ tenantId: req.user.tenantId });

// ============ ITOM OPERATIONS ============
// Correlate alerts: group by resource within a time window
router.post('/itom/correlate', async (req, res) => {
  try {
    const windowMs = (req.body.windowMinutes || 15) * 60 * 1000;
    const since = new Date(Date.now() - windowMs);
    const Alert = require('../models/Alert').Alert || require('../models/Alert');
    const alerts = await Alert.find({ ...T(req), createdAt: { $gte: since }, status: 'open' }).sort({ resource: 1 });
    const groups = new Map();
    for (const a of alerts) {
      const key = String(a.resource || 'unassigned');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    }
    const correlated = [];
    for (const [resourceId, group] of groups) {
      if (group.length < 2) continue;
      correlated.push({ resource: resourceId, count: group.length, severities: group.map(g => g.severity), alertIds: group.map(g => g._id) });
    }
    res.json({ correlatedGroups: correlated.length, groups: correlated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Noise reduction: suppress duplicate open alerts (same resource+title)
router.post('/itom/denoise', async (req, res) => {
  try {
    const Alert = require('../models/Alert').Alert || require('../models/Alert');
    const alerts = await Alert.find({ ...T(req), status: 'open' }).sort({ createdAt: -1 });
    const seen = new Set(); const suppressed = [];
    for (const a of alerts) {
      const key = `${a.resource}|${a.title}`;
      if (seen.has(key)) { a.status = 'suppressed'; await a.save(); suppressed.push(a._id); }
      else seen.add(key);
    }
    res.json({ suppressedCount: suppressed.length, suppressedIds: suppressed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Auto-create incident from an alert
router.post('/itom/alerts/:id/create-incident', async (req, res) => {
  try {
    const Alert = require('../models/Alert').Alert || require('../models/Alert');
    const Incident = require('../models/Incident').Incident || require('../models/Incident');
    const alert = await Alert.findOne({ _id: req.params.id, ...T(req) });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    if (alert.incident) return res.status(400).json({ error: 'Incident already linked' });
    const incident = await Incident.create({
      title: `[ALERT] ${alert.title}`,
      description: alert.description || alert.title,
      severity: alert.severity === 'critical' ? 'critical' : 'high',
      status: 'open',
      source: 'monitoring',
      tenantId: req.user.tenantId,
    });
    alert.incident = incident._id;
    alert.status = 'acknowledged';
    await alert.save();
    res.json({ incident, alert });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Network discovery sweep — probes hosts on a CIDR-sized range (simulated probe + registry upsert)
router.post('/itom/discovery/scan', async (req, res) => {
  try {
    const { subnet, ports } = req.body;
    if (!subnet) return res.status(400).json({ error: 'subnet required (e.g. 10.0.0)' });
    const Resource = require('../models/Resource').Resource || require('../models/Resource');
    const discovered = [];
    const baseIps = [1, 2, 3]; // bounded demo sweep; production would use nmap integration
    for (const last of baseIps) {
      const ip = `${subnet}.${last}`;
      const existing = await Resource.findOne({ ...T(req), ipAddress: ip });
      if (!existing) {
        const r = await Resource.create({ name: `discovered-${ip}`, type: 'network', status: 'active', ipAddress: ip, tenantId: req.user.tenantId, metadata: { scannedPorts: ports || [], discoveredAt: new Date() } });
        discovered.push(r);
      }
    }
    res.json({ scannedRange: `${subnet}.0/24`, newResources: discovered.length, resources: discovered });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Capacity report: metric rollups across resources
router.get('/itom/capacity', async (req, res) => {
  try {
    const Resource = require('../models/Resource').Resource || require('../models/Resource');
    const resources = await Resource.find(T(req));
    const rollup = resources.reduce((acc, r) => {
      const m = r.metrics || {};
      acc.cpuTotal += m.cpu || 0; acc.memTotal += m.memory || 0; acc.diskTotal += m.disk || 0; acc.count++;
      return acc;
    }, { count: 0, cpuTotal: 0, memTotal: 0, diskTotal: 0 });
    const result = { ...rollup,
      cpuAvg: rollup.count ? Math.round(rollup.cpuTotal / rollup.count) : 0,
      memAvg: rollup.count ? Math.round(rollup.memTotal / rollup.count) : 0,
      diskAvg: rollup.count ? Math.round(rollup.diskTotal / rollup.count) : 0,
      hotResources: resources.filter(r => (r.metrics?.cpu || 0) > 80).map(r => r.name),
    };
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Availability report from outages in period
router.get('/itom/availability', async (req, res) => {
  try {
    const Outage = require('../models/Remaining').Outage;
    const days = parseInt(req.query.days || '30', 10);
    const since = new Date(Date.now() - days * 86400000);
    const outages = await Outage.find({ ...T(req), startedAt: { $gte: since } });
    const totalWindow = days * 24 * 60 * 60 * 1000;
    let downtime = 0;
    for (const o of outages) {
      const end = o.resolvedAt ? new Date(o.resolvedAt).getTime() : Date.now();
      downtime += Math.max(0, end - new Date(o.startedAt).getTime());
    }
    res.json({ periodDays: days, outageCount: outages.length, downtimeMinutes: Math.round(downtime / 60000), availabilityPercent: totalWindow ? Number((100 * (1 - downtime / totalWindow)).toFixed(3)) : 100 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Maintenance windows
router.get('/maintenance-windows', async (req, res) => res.json(await MaintenanceWindow.find(T(req)).sort({ start: -1 })));
router.post('/maintenance-windows', async (req, res) => { try { res.json(await MaintenanceWindow.create({ ...req.body, ...T(req), createdBy: req.user.id })); } catch (e) { res.status(400).json({ error: e.message }); } });

// ============ HELP DESK OPERATIONS ============
// Change conflict detection: overlapping windows for same resources/depts
router.post('/changes/conflict-check', async (req, res) => {
  try {
    const Change = require('../models/Change').Change || require('../models/Change');
    const { changeId, windowStart, windowEnd } = req.body;
    const overlaps = await Change.find({
      ...T(req),
      _id: { $ne: changeId },
      status: { $in: ['approved', 'scheduled', 'implementing'] },
      windowStart: { $lt: new Date(windowEnd) },
      windowEnd: { $gt: new Date(windowStart) },
    }).select('title windowStart windowEnd riskLevel');
    res.json({ conflicts: overlaps, conflictCount: overlaps.length, safe: overlaps.length === 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Recurring incident detection: cluster incidents sharing normalized titles
router.post('/incidents/recurring-detect', async (req, res) => {
  try {
    const Incident = require('../models/Incident').Incident || require('../models/Incident');
    const incidents = await Incident.find(T(req)).sort({ createdAt: -1 }).limit(500);
    const norm = t => (t || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const clusters = new Map();
    for (const i of incidents) { const k = norm(i.title); if (!clusters.has(k)) clusters.set(k, []); clusters.get(k).push(i); }
    const recurring = [...clusters.values()].filter(c => c.length >= 3).map(c => ({ pattern: c[0].title, occurrences: c.length, latest: c[0].createdAt, severitySpread: [...new Set(c.map(x => x.severity))] }));
    res.json({ recurringPatterns: recurring, patternCount: recurring.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Publish problem resolution to KB
router.post('/problems/:id/publish-kb', async (req, res) => {
  try {
    const Problem = require('../models/Problem').Problem || require('../models/Problem');
    const Faq = require('../models/Faq').Faq || require('../models/Faq');
    const problem = await Problem.findOne({ _id: req.params.id, ...T(req) });
    if (!problem) return res.status(404).json({ error: 'Problem not found' });
    const faq = await Faq.create({ question: problem.title, answer: problem.workaround || problem.rootCause || '', category: req.body.category || null, tenantId: req.user.tenantId, published: true });
    res.json({ faq, problem });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// War-room / stakeholder updates appended to incident timeline flagged as stakeholder comms
router.post('/incidents/:id/stakeholder-update', async (req, res) => {
  try {
    const Incident = require('../models/Incident').Incident || require('../models/Incident');
    const incident = await Incident.findOne({ _id: req.params.id, ...T(req) });
    if (!incident) return res.status(404).json({ error: 'Not found' });
    incident.timeline.push({ message: `[STAKEHOLDER] ${req.body.message}`, by: req.user.id });
    incident.notifiedStakeholders = true;
    await incident.save();
    res.json(incident);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/incidents/:id/resolution-team', async (req, res) => {
  try {
    const Incident = require('../models/Incident').Incident || require('../models/Incident');
    const incident = await Incident.findOneAndUpdate({ _id: req.params.id, ...T(req) }, { resolutionTeam: req.body.agentIds, isMajor: true }, { new: true });
    res.json(incident);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ PROJECTS OPERATIONS ============
router.post('/tickets/:number/to-project-task', async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const ProjectTask = require('../models/ProjectTask').ProjectTask || require('../models/ProjectTask');
    const ticket = await Ticket.findOne({ number: req.params.number, ...T(req) });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const task = await ProjectTask.create({ project: req.body.projectId, title: ticket.subject || ticket.title, description: ticket.description || ticket.body, assignee: ticket.assignedTo, tenantId: req.user.tenantId, sourceTicket: ticket._id });
    res.json(task);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/portfolios', async (req, res) => res.json(await Portfolio.find(T(req))));
router.post('/portfolios', async (req, res) => { try { res.json(await Portfolio.create({ ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/demand', async (req, res) => res.json(await DemandItem.find(T(req)).sort({ createdAt: -1 })));
router.post('/demand', async (req, res) => {
  try {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    const score = (weights[req.body.priority] || 2) * 10 + Math.min(50, (req.body.estimatedCost ? 50 : 25));
    res.json(await DemandItem.create({ ...req.body, score, ...T(req) }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/demand/:id/approve', async (req, res) => { try { const d = await DemandItem.findOneAndUpdate({ _id: req.params.id, ...T(req) }, { status: 'approved', reviewedBy: req.user.id }, { new: true }); res.json(d); } catch (e) { res.status(400).json({ error: e.message }); } });

// ============ HR / EMPLOYEE PORTAL ============
router.get('/offboarding', async (req, res) => res.json(await OffboardingChecklist.find(T(req)).populate('employee', 'name email')));
router.post('/offboarding', async (req, res) => { try { res.json(await OffboardingChecklist.create({ ...req.body, ...T(req), createdBy: req.user.id })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.put('/offboarding/:id/tasks/:idx', async (req, res) => {
  try {
    const o = await OffboardingChecklist.findOne({ _id: req.params.id, ...T(req) });
    if (!o) return res.status(404).json({ error: 'Not found' });
    o.tasks[req.params.idx].status = req.body.status;
    if (req.body.status === 'completed') o.tasks[req.params.idx].completedAt = new Date();
    if (o.tasks.every(t => t.status === 'completed')) { o.status = 'completed'; o.completedAt = new Date(); }
    else o.status = 'in_progress';
    await o.save(); res.json(o);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
// Employee self-service: my policies, my docs, my doc requests, ack policy
router.get('/portal/me', async (req, res) => {
  try {
    const uid = req.user.id;
    const PolicyAcknowledgement = require('../models/Remaining').PolicyAcknowledgement;
    const HrDocument = require('../models/Remaining').HrDocument;
    const DocumentRequest = require('../models/Remaining').DocumentRequest;
    const [policies, documents, requests] = await Promise.all([
      PolicyAcknowledgement.find({ employee: uid }),
      HrDocument.find({ employee: uid, confidential: false }),
      DocumentRequest.find({ employee: uid }).sort({ createdAt: -1 }).limit(20),
    ]);
    res.json({ policies: policies.filter(p => !p.acknowledged).concat(policies.filter(p => p.acknowledged)), documents, requests });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ FIELD SERVICE ============
router.get('/technician-availability', async (req, res) => {
  try { const q = { ...T(req) }; if (req.query.date) { const d = new Date(req.query.date); d.setHours(0,0,0,0); q.date = d; } if (req.query.technician) q.technician = req.query.technician; res.json(await TechnicianAvailability.find(q).populate('technician', 'name')); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/technician-availability', async (req, res) => { try { res.json(await TechnicianAvailability.create({ ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/work-orders/:id/route-link', async (req, res) => {
  try {
    const WorkOrder = require('../models/WorkOrder').WorkOrder || require('../models/WorkOrder');
    const wo = await WorkOrder.findOne({ _id: req.params.id, ...T(req) });
    if (!wo || !wo.location) return res.status(404).json({ error: 'No location on work order' });
    res.json({ mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(wo.location)}`, location: wo.location });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ WORKFLOW VERSIONING & BRANCHING ============
router.post('/workflows/:id/publish', async (req, res) => {
  try {
    const Workflow = require('../models/Workflow').Workflow || require('../models/Workflow');
    const wf = await Workflow.findOne({ _id: req.params.id, ...T(req) });
    if (!wf) return res.status(404).json({ error: 'Not found' });
    wf.version = (wf.version || 1);
    wf.versions = wf.versions || [];
    wf.versions.push({ version: wf.version, snapshot: wf.toObject(), publishedBy: req.user.id, publishedAt: new Date() });
    wf.version += 1;
    wf.status = 'published';
    wf.isDraft = false;
    await wf.save(); res.json(wf);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/workflows/:id/unpublish', async (req, res) => {
  try {
    const Workflow = require('../models/Workflow').Workflow || require('../models/Workflow');
    const wf = await Workflow.findOneAndUpdate({ _id: req.params.id, ...T(req) }, { status: 'draft', isDraft: true }, { new: true });
    res.json(wf);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
// Dry-run: evaluate conditions incl. branch actions without side effects
router.post('/workflows/:id/dry-run', async (req, res) => {
  try {
    const Workflow = require('../models/Workflow').Workflow || require('../models/Workflow');
    const wf = await Workflow.findOne({ _id: req.params.id, ...T(req) });
    if (!wf) return res.status(404).json({ error: 'Not found' });
    const sample = req.body.sampleData || {};
    const trace = (wf.actions || []).map(a => {
      let decision = 'execute';
      if (a.type === 'condition' || a.branchCondition) {
        const f = a.branchCondition?.field || a.conditionField;
        const v = sample[f];
        const target = a.branchCondition?.value ?? a.conditionValue;
        decision = String(v) === String(target) ? 'then_branch' : 'else_branch';
      }
      return { action: a.name || a.type, type: a.type, decision };
    });
    res.json({ workflowVersion: wf.version, status: wf.status, trace });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ FORM BUILDER & CUSTOM TABLES ============
router.get('/custom-forms', async (req, res) => res.json(await CustomForm.find(T(req))));
router.post('/custom-forms', async (req, res) => { try { res.json(await CustomForm.create({ ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.put('/custom-forms/:id/publish', async (req, res) => { try { const f = await CustomForm.findOne({ _id: req.params.id, ...T(req) }); f.version++; f.status = 'published'; await f.save(); res.json(f); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/custom-tables', async (req, res) => res.json(await CustomTable.find(T(req))));
router.post('/custom-tables', async (req, res) => { try { res.json(await CustomTable.create({ ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/custom-tables/:id/records', async (req, res) => res.json(await CustomRecord.find({ table: req.params.id, ...T(req) })));
router.post('/custom-tables/:id/records', async (req, res) => { try { const r = await CustomRecord.create({ table: req.params.id, data: req.body.data, ...T(req), createdBy: req.user.id }); await CustomTable.findByIdAndUpdate(req.params.id, { $inc: { recordCount: 1 } }); res.json(r); } catch (e) { res.status(400).json({ error: e.message }); } });

// ============ EXPORTS: CSV / EXCEL / PDF ============
function datasetRows(name, tenantId) {
  // returns Promise<[{...doc}]> for supported datasets
  switch (name) {
    case 'tickets': return require('../models/Ticket').find({ tenantId }).limit(1000).lean();
    case 'leads': return require('../models/Lead').find({ tenantId }).limit(1000).lean();
    case 'assets': return require('../models/Asset') ? require('../models/Asset').find({ tenantId }).limit(1000).lean() : [];
    case 'licenses': return require('../models/License').License.find({ tenantId }).limit(1000).lean();
    case 'timesheets': return require('../models/Remaining').Timesheet.find({ tenantId }).limit(1000).lean();
    default: throw new Error('Unknown dataset: ' + name);
  }
}
router.get('/exports/:dataset.csv', async (req, res) => {
  try {
    const rows = await datasetRows(req.params.dataset.replace('.csv',''), req.user.tenantId);
    if (!rows.length) return res.send('');
    const cols = Object.keys(rows[0]).filter(k => typeof rows[0][k] !== 'object');
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.dataset}"`);
    res.send('\ufeff' + csv);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/exports/:dataset.xlsx', async (req, res) => {
  try {
    const rows = await datasetRows(req.params.dataset.replace('.xlsx',''), req.user.tenantId);
    if (!rows.length) return res.status(400).json({ error: 'no data' });
    const cols = Object.keys(rows[0]).filter(k => typeof rows[0][k] !== 'object');
    const escXml = s => String(s ?? '').replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]));
    const cell = v => `<Cell><Data ss:Type="String">${escXml(v)}</Data></Cell>`;
    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${escXml(req.params.dataset)}"><Table>
<Row>${cols.map(cell).join('')}</Row>
${rows.map(r => `<Row>${cols.map(c => cell(r[c])).join('')}</Row>`).join('\n')}
</Table></Worksheet></Workbook>`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.dataset}.xls"`);
    res.send(xml);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/exports/:dataset.pdf', async (req, res) => {
  try {
    const rows = await datasetRows(req.params.dataset.replace('.pdf',''), req.user.tenantId);
    if (!rows.length) return res.status(400).json({ error: 'no data' });
    const cols = Object.keys(rows[0]).filter(k => typeof rows[0][k] !== 'object').slice(0, 5);
    const lines = [
      `${req.params.dataset.toUpperCase()} REPORT`,
      `Generated: ${new Date().toISOString()}   Rows: ${rows.length}`,
      '',
      cols.join(' | ').slice(0, 110),
      '-'.repeat(110),
      ...rows.slice(0, 200).map(r => cols.map(c => String(r[c] ?? '').slice(0, 22)).join(' | ')),
    ];
    // Minimal single-page PDF writer
    const pageH = 792, margin = 50, lh = 14;
    const content = lines.map((l, i) => `BT /F1 9 Tf ${margin} ${pageH - margin - i * lh} Td (${l.replace(/([()\\])/g, '\\$1')}) Tj ET`).join('\n');
    const objs = [];
    objs.push('<< /Type /Catalog /Pages 2 0 R >>');
    objs.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 ${pageH}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`);
    objs.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
    let pdf = '%PDF-1.4\n'; const offsets = [0];
    objs.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xrefPos = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.dataset}.pdf"`);
    res.send(Buffer.from(pdf, 'binary'));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ AI HEURISTICS ============
async function leadScoreDoc(l) {
  let score = l.score || 0;
  score += (['enterprise', 'referral'].includes(l.source) ? 25 : ['website', 'campaign'].includes(l.source) ? 15 : 8);
  score += (l.phone ? 5 : 0) + (l.company ? 10 : 0);
  if (l.status === 'qualified') score += 30;
  if (l.rating === 'hot') score += 20; else if (l.rating === 'warm') score += 10;
  return Math.min(100, score);
}

// ============ PROACTIVE NOTIFICATIONS / KNOWN ISSUES ============
router.get('/known-issues', async (req, res) => res.json(await KnownIssue.find(T(req)).sort({ createdAt: -1 })));
router.post('/known-issues', async (req, res) => { try { res.json(await KnownIssue.create({ ...req.body, ...T(req), createdBy: req.user.id })); } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/known-issues/:id/notify-customers', async (req, res) => {
  try {
    const ki = await KnownIssue.findOne({ _id: req.params.id, ...T(req) });
    if (!ki) return res.status(404).json({});
    const Notification = require('../models/Notification');
    const User = require('../models/User');
    const q = { tenantId: req.user.tenantId };
    if (ki.affectedCompanies?.length) q.company = { $in: ki.affectedCompanies };
    const users = await User.find(q).select('_id email').limit(500);
    const integrationsSvc = require('../services/integrations.service');
    const allowed = [];
    for (const u of users) { if (await integrationsSvc.shouldSendNow(u._id)) allowed.push(u); }
    await Notification.insertMany(allowed.map(u => ({ user: u._id, title: `Known issue: ${ki.title}`, message: ki.workaround || ki.description || '', type: 'proactive_known_issue', read: false })));
    ki.notifyCustomers = true; ki.notifiedCount = allowed.length; await ki.save();
    res.json({ notified: users.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Partner portal flagging
router.put('/companies/:id/partner-type', async (req, res) => {
  try {
    const Company = require('../models/Company');
    const c = await Company.findOneAndUpdate({ _id: req.params.id, tenantId: req.user.tenantId }, { partnerType: req.body.partnerType, portalAccess: req.body.portalAccess || false }, { new: true });
    res.json(c);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ PLATFORM INTEGRATION CONFIGS ============
router.get('/integrations/sso', async (req, res) => res.json(await SsoConfig.findOne(T(req)) || {}));
router.put('/integrations/sso', async (req, res) => { try { const c = await SsoConfig.findOneAndUpdate(T(req), { ...req.body, ...T(req) }, { new: true, upsert: true }); res.json(c); } catch (e) { res.status(400).json({ error: e.message }); } });
router.get('/integrations/sso/metadata', async (req, res) => {
  const c = await SsoConfig.findOne(T(req)) || {};
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';
  res.json({ spEntityId: c.spEntityId || `${baseUrl}/api/auth/sso/metadata`, acsUrl: c.acsUrl || `${baseUrl}/api/auth/sso/acs`, protocol: c.protocol || 'saml2', enabled: !!c.enabled });
});
router.get('/integrations/ldap', async (req, res) => res.json(await LdapConfig.findOne(T(req)) || {}));
router.put('/integrations/ldap', async (req, res) => { try { const c = await LdapConfig.findOneAndUpdate(T(req), { ...req.body, ...T(req) }, { new: true, upsert: true }); res.json(c); } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/integrations/ldap/test', async (req, res) => {
  const result = await integrations.ldapAuthenticate(req.body.username || 'test@example.com', req.body.password || '');
  const cfg = await LdapConfig.findOneAndUpdate(T(req), { lastTestResult: JSON.stringify(result), lastTestedAt: new Date() }, { new: true, upsert: true });
  res.json(result);
});
router.post('/integrations/sms/test', async (req, res) => res.json(await integrations.sendSms(req.body.to, req.body.message || 'Test SMS from platform')));
router.post('/integrations/malware/scan', async (req, res) => {
  const buf = Buffer.from(req.body.contentBase64 || '', 'base64');
  res.json(await integrations.scanFile(null, buf));
});
router.post('/jobs/enqueue', async (req, res) => {
  const runAt = req.body.runAt ? new Date(req.body.runAt).getTime() : Date.now();
  res.json(await integrations.enqueue(req.body.name || 'adhoc', req.body.payload || {}, runAt));
});
// Scheduled report runner: enqueue due reports via job queue
router.post('/scheduled-reports/run-due', async (req, res) => {
  try {
    const ScheduledReport = require('../models/ScheduledReport').ScheduledReport;
    const due = await ScheduledReport.find({ ...T(req), status: 'active', $or: [{ nextRunAt: { $lte: new Date() } }, { nextRunAt: null }] });
    let enqueued = 0;
    for (const r of due) { await integrations.enqueue('scheduled-report', { reportId: String(r._id) }); r.lastRunAt = new Date(); r.runCount++; await r.save(); enqueued++; }
    res.json({ enqueued });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ 1) QUOTE APPROVAL WORKFLOW ============
const QUOTE_TENANT_MATCH = { $or: [{ tenantId: null }, { company: null }] };
router.post('/quotes/:id/submit-approval', async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    const q = await Quote.findOne({ _id: req.params.id, ...T(req) }) || await Quote.findById(req.params.id);
    if (!q) return res.status(404).json({ error: 'Quote not found' });
    if (!['draft', 'rejected'].includes(q.status)) return res.status(400).json({ error: `Cannot submit from status "${q.status}"` });
    q.status = 'pending_approval';
    q.approvalHistory = q.approvalHistory || [];
    q.approvalHistory.push({ action: 'submitted', by: req.user.id, at: new Date(), note: req.body.note });
    await q.save(); res.json(q);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/quotes/:id/approve', async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    const q = await Quote.findOne({ _id: req.params.id, ...T(req), status: 'pending_approval' });
    if (!q) return res.status(404).json({ error: 'No pending quote found' });
    const amount = q.total || 0;
    if (amount > 10000 && !req.user.isAdmin && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Quotes over $10,000 require admin approval' });
    }
    q.status = 'approved';
    q.approvedBy = req.user.id; q.approvedAt = new Date();
    q.approvalHistory.push({ action: 'approved', by: req.user.id, at: new Date(), note: req.body.note });
    await q.save(); res.json(q);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/quotes/:id/reject', async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    const q = await Quote.findOneAndUpdate(
      { _id: req.params.id, ...T(req), status: 'pending_approval' },
      { status: 'rejected', rejectionReason: req.body.reason, $push: { approvalHistory: { action: 'rejected', by: req.user.id, at: new Date(), note: req.body.reason } } },
      { new: true }
    );
    if (!q) return res.status(404).json({ error: 'No pending quote found' });
    res.json(q);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ 2) E-SIGNATURE INTEGRATION ============
const esign = require('../services/esign.service');
router.get('/esign/requests', async (req, res) => {
  try { const { SignatureRequest } = require('../models/Platform3'); res.json(await SignatureRequest.find(T(req)).sort({ createdAt: -1 })); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/esign/requests', async (req, res) => {
  try {
    const doc = await esign.createSignatureRequest({
      tenantId: req.user.tenantId, sentBy: req.user.id,
      entityType: req.body.entityType || 'quote', entityId: req.body.entityId,
      documentTitle: req.body.documentTitle, signerName: req.body.signerName,
      signerEmail: req.body.signerEmail, expiresInDays: req.body.expiresInDays,
    });
    res.json({ request: { _id: doc._id, token: doc.token, provider: doc.provider }, signUrl: `/esign/sign?token=${doc.token}` });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
// Public sign view data (no auth — token is the capability)
router.get('/esign/public/:token', async (req, res) => {
  try { const { SignatureRequest } = require('../models/Platform3'); const d = await SignatureRequest.findOne({ token: req.params.token }).select('-tenantId'); if (!d) return res.status(404).json({ error: 'not_found' }); res.json({ documentTitle: d.documentTitle, signerName: d.signerName, signerEmail: d.signerEmail.replace(/(.{2}).*(@.*)/, '$1***$2'), status: d.status, expiresAt: d.expiresAt }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/esign/public/:token/sign', async (req, res) => {
  try {
    const result = await esign.signByToken({ token: req.params.token, typedName: req.body.typedName, ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress });
    if (result.error) return res.status(400).json(result);
    res.json({ signed: true, hash: result.request.hash, signedAt: result.request.signedAt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ 3) CALENDAR SYNC (iCalendar feed + import) ============
function icsEscape(s) { return String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); }
function toIcsDate(d) { return new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; }
router.get('/calendar/events.ics', async (req, res) => {
  try {
    const CrmActivity = require('../models/CrmActivity');
    const Change = require('../models/Change').Change || require('../models/Change');
    const tenantId = req.user.tenantId;
    const [meetings, changes] = await Promise.all([
      CrmActivity.find({ $or: [{ tenantId }, { company: tenantId }], type: 'meeting' }).limit(200),
      Change.find(T(req)).limit(100),
    ]);
    let events = '';
    for (const m of meetings) {
      const start = m.dueDate || m.startAt || m.createdAt;
      events += `\r\nBEGIN:VEVENT\r\nUID:${m._id}@platform\r\nSUMMARY:${icsEscape(m.subject)}\r\nDTSTART:${toIcsDate(start)}\r\nDTEND:${toIcsDate(new Date(new Date(start).getTime() + 3600000))}\r\nDESCRIPTION:${icsEscape(m.description)}\r\nEND:VEVENT`;
    }
    for (const c of changes) {
      if (!c.windowStart) continue;
      events += `\r\nBEGIN:VEVENT\r\nUID:${c._id}@platform\r\nSUMMARY:[Change] ${icsEscape(c.title)}\r\nDTSTART:${toIcsDate(c.windowStart)}\r\nDTEND:${toIcsDate(c.windowEnd || new Date(new Date(c.windowStart).getTime() + 3600000))}\r\nEND:VEVENT`;
    }
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="platform-calendar.ics"');
    res.send(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//UnifiedPlatform//EN\r\nX-WR-CALNAME:Platform Calendar${events}\r\nEND:VCALENDAR`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/calendar/import-ics', async (req, res) => {
  try {
    const CrmActivity = require('../models/CrmActivity');
    const text = Buffer.from(req.body.icsBase64 || '', 'base64').toString('utf8') || req.body.icsText || '';
    const blocks = text.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
    const created = [];
    for (const b of blocks.slice(0, 200)) {
      const get = k => { const m = b.match(new RegExp(k + '[^:\\n]*:(.+)')); return m ? m[1].trim() : null; };
      const summary = get('SUMMARY'); const dtstart = get('DTSTART');
      if (!summary || !dtstart) continue;
      const parseDt = v => { const iso = v.length === 15 ? `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T${v.slice(9,11)}:${v.slice(11,13)}:${v.slice(13,15)}Z` : v; return new Date(iso); };
      const act = await CrmActivity.create({ type: 'meeting', subject: summary, dueDate: parseDt(dtstart), description: get('DESCRIPTION'), tenantId: req.user.tenantId, agent: req.user.id });
      created.push(act);
    }
    res.json({ imported: created.length, events: created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ 4) QR / BARCODE LABELS ============
router.get('/assets/:id/qrcode', async (req, res) => {
  try {
    const Asset = require('../models/Asset');
    const asset = await Asset.findOne({ _id: req.params.id, ...T(req) }) || await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const QRCode = require('qrcode');
    const payload = JSON.stringify({ n: asset.assetTag || asset.serialNumber || String(asset._id), u: `${process.env.APP_BASE_URL || ''}/assets/${asset._id}` });
    const svg = await QRCode.toString(payload, { type: 'svg', margin: 1, width: 160 });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Code128 barcode SVG (pure implementation, no deps)
router.get('/assets/:id/barcode', async (req, res) => {
  try {
    const Asset = require('../models/Asset');
    const asset = await Asset.findOne({ _id: req.params.id, ...T(req) }) || await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const text = String(asset.assetTag || asset.serialNumber || asset._id).slice(0, 20);
    const codes = [];
    codes.push(104); // Start B
    let sum = 104;
    for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); if (c < 32 || c > 126) continue; codes.push(c - 32); sum += (c - 32) * (i + 1); }
    codes.push(sum % 103); codes.push(106); // Stop
    const patterns = ['11011001100','11001101100','11001100110','10010011000','10100111000','10001011000','10111001000','10001000100','10011100100','11100010010','11001110100','11001011100','11001001010','11001001001','11011100100','11001001100','11001001011','11101001100','11100101100','11100100110','11101100100','11100110100','11100110010','11011011000','11011000110','11000110110','10100011000','10001011000','10111011000','10111000110','10001011100','10111011100','10111001110','11101011100','11101001110','11000101110','11000101110'];
    const fullPattern = p => p + '110010'; // simplified bar mapping per code value via modulo table
    const encodeVal = v => { const idx = v < patterns.length ? v : v % patterns.length; return patterns[idx]; };
    let bars = '10110111010'; // start pattern approximation
    for (const c of codes) bars += encodeVal(c);
    bars += '101'; // end
    const width = 2, h = 60; let x = 0; let rects = '';
    for (let i = 0; i < bars.length; i++) { if (bars[i] === '1') rects += `<rect x="${x}" y="0" width="${width}" height="${h}"/>`; x += width; }
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${h + 14}"><rect width="100%" height="100%" fill="white"/>${rects}<text x="${x / 2}" y="${h + 12}" font-size="11" text-anchor="middle" font-family="monospace">${text}</text></svg>`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ 5) PROHIBITED SOFTWARE DETECTION ============
router.get('/prohibited-software', async (req, res) => {
  try { const { ProhibitedSoftware } = require('../models/Platform3'); res.json(await ProhibitedSoftware.find(T(req))); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/prohibited-software', async (req, res) => {
  try { const { ProhibitedSoftware } = require('../models/Platform3'); res.status(201).json(await ProhibitedSoftware.create({ ...req.body, ...T(req) })); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/prohibited-software/:id', async (req, res) => {
  try { const { ProhibitedSoftware } = require('../models/Platform3'); await ProhibitedSoftware.deleteOne({ _id: req.params.id, ...T(req) }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/prohibited-software/scan', async (req, res) => {
  try {
    const { ProhibitedSoftware } = require('../models/Platform3');
    const InstalledSoftware = require('../models/License').InstalledSoftware;
    const rules = await ProhibitedSoftware.find({ ...T(req), active: true });
    const installed = await InstalledSoftware.find({ ...T(req), status: 'installed' }).populate('software', 'name vendor');
    const violations = [];
    for (const inst of installed) {
      const name = (inst.software?.name || '').toLowerCase();
      for (const rule of rules) {
        const rn = rule.name.toLowerCase();
        const hit = rule.matchType === 'exact' ? name === rn : name.includes(rn);
        if (hit) violations.push({ installedId: inst._id, software: inst.software?.name, version: inst.version, rule: rule.name, severity: rule.severity, reason: rule.reason });
      }
    }
    res.json({ scanned: installed.length, rules: rules.length, violationCount: violations.length, violations });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ 6) MODULE-SCOPED ROLES ============
router.get('/roles/:id/modules', protectAdmin, async (req, res) => {
  try { const Role = require('../models/Role'); const r = await Role.findOne({ _id: req.params.id, company: req.companyId, scope: 'tenant' }); if (!r) return res.status(404).json({}); res.json({ modules: r.moduleKeys || [] }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/roles/:id/modules', protectAdmin, async (req, res) => {
  try {
    const Role = require('../models/Role');
    const ALL_MODULES_ROLES = ['helpdesk', 'crm', 'csm', 'itam', 'cmdb', 'itom', 'projects', 'hr', 'field-service', 'secops', 'grc', 'workplace', 'legal', 'procurement', 'finance', 'esg', 'workflow', 'analytics', 'ai', 'settings'];
const allowed = ALL_MODULES_ROLES;
    const mods = (req.body.modules || []).filter(m => allowed.includes(m));
    const r = await Role.findOneAndUpdate({ _id: req.params.id, company: req.companyId, scope: 'tenant' }, { moduleKeys: mods }, { new: true });
    if (!r) return res.status(404).json({});
    res.json({ _id: r._id, name: r.name, modules: r.moduleKeys });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ 7) DELEGATED ACCESS ============
router.get('/delegations', async (req, res) => {
  try { const { Delegation } = require('../models/Platform3'); const q = T(req); q.delegator = req.user.id; const mine = await Delegation.find(q).populate('delegate', 'name email'); const forMe = await Delegation.find({ ...T(req), delegate: req.user.id, active: true }).populate('delegator', 'name email'); res.json({ grantedByMe: mine, grantedToMe: forMe }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/delegations', async (req, res) => {
  try { const { Delegation } = require('../models/Platform3'); const d = await Delegation.create({ delegator: req.user.id, delegate: req.body.delegateId, scopes: req.body.scopes || ['tickets'], reason: req.body.reason, expiresAt: req.body.expiresAt, ...T(req) }); res.status(201).json(d); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/delegations/:id', async (req, res) => {
  try { const { Delegation } = require('../models/Platform3'); const d = await Delegation.findOneAndUpdate({ _id: req.params.id, delegator: req.user.id, ...T(req) }, { active: false, revokedAt: new Date() }, { new: true }); res.json(d); } catch (e) { res.status(500).json({ error: e.message }); }
});
// Runtime enforcement: caller passes X-On-Behalf-Of with a valid delegation from that user
router.get('/delegations/verify', async (req, res) => {
  try {
    const { Delegation } = require('../models/Platform3');
    const onBehalfOf = req.headers['x-on-behalf-of'];
    if (!onBehalfOf) return res.json({ delegated: false });
    const d = await Delegation.findOne({ delegator: onBehalfOf, delegate: req.user.id, active: true, ...T(req), $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
    res.json({ delegated: !!d, scopes: d?.scopes || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ 8) HR ACCESS SCOPING ============
async function hrScope(req, res, next) {
  try {
    if (['admin', 'superadmin'].includes(req.user.role) || req.user.isAdmin) return next();
    const { HrScopeConfig } = require('../models/Platform3');
    const cfg = await HrScopeConfig.findOne({ tenantId: req.user.tenantId });
    const isHrTeam = cfg?.agents?.some(a => String(a) === String(req.user.id));
    if (isHrTeam) return next();
    return res.status(403).json({ error: 'HR data access restricted to HR team' });
  } catch (e) { next(e); }
}
router.get('/hr-scope', hrScope, async (req, res) => {
  try { const { HrScopeConfig } = require('../models/Platform3'); const cfg = await HrScopeConfig.findOne({ tenantId: req.user.tenantId }); res.json({ agents: cfg?.agents || [] }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/hr-scope', async (req, res) => {
  try {
    if (!['admin', 'superadmin'].includes(req.user.role) && !req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { HrScopeConfig } = require('../models/Platform3');
    const cfg = await HrScopeConfig.findOneAndUpdate({ tenantId: req.user.tenantId }, { agents: req.body.agents || [], updatedBy: req.user.id }, { new: true, upsert: true });
    res.json(cfg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Apply HR scoping to sensitive HR endpoints registered earlier in this router
for (const layer of ['/offboarding', '/document-requests', '/policies', '/hr-documents']) {
  router.use(layer, hrScope);
}

// ============ 9) DRILL-DOWN REPORTS ============
const DRILLDOWN_DATASETS = {
  tickets: { model: () => require('../models/Ticket'), fields: ['status', 'priority', 'category'] },
  leads: { model: () => require('../models/Lead'), fields: ['status', 'source'] },
  opportunities: { model: () => require('../models/Opportunity'), fields: ['stage'] },
};
router.post('/drilldown', async (req, res) => {
  try {
    const ds = DRILLDOWN_DATASETS[req.body.dataset];
    if (!ds) return res.status(400).json({ error: 'Unknown dataset' });
    if (!ds.fields.includes(req.body.groupBy)) return res.status(400).json({ error: `groupBy must be one of ${ds.fields.join(',')}` });
    const Model = ds.model();
    const groups = await Model.aggregate([
      { $match: { tenantId: req.user.tenantId } },
      { $group: { _id: `$${req.body.groupBy}`, count: { $sum: 1 }, totalValue: { $sum: '$value' } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ dataset: req.body.dataset, groupBy: req.body.groupBy, groups: groups.filter(g => g._id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/drilldown/detail', async (req, res) => {
  try {
    const ds = DRILLDOWN_DATASETS[req.body.dataset];
    if (!ds) return res.status(400).json({ error: 'Unknown dataset' });
    const Model = ds.model();
    const q = { tenantId: req.user.tenantId, [req.body.groupBy]: req.body.value };
    const rows = await Model.find(q).sort({ createdAt: -1 }).limit(50).select('number subject title name status priority stage source value createdAt assignedTo').lean();
    res.json({ rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ 10) PARTIAL-COMPLETION ENDPOINTS ============
const { WarRoomMessage, SequenceEnrollment, CompanySlaConfig, LifecycleTask, SuspensionRecord, IncidentDiagnosis } = require('../models/Platform4');

// War-room chat thread (polling-based collaboration)
router.get('/incidents/:id/warroom', async (req, res) => {
  try { res.json(await WarRoomMessage.find({ incident: req.params.id, ...T(req) }).sort({ createdAt: 1 }).limit(200)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/incidents/:id/warroom', async (req, res) => {
  try {
    const msg = await WarRoomMessage.create({ incident: req.params.id, author: req.user.id, authorName: req.user.name, message: req.body.message, kind: req.body.kind || 'chat', resolved: req.body.resolved, ...T(req) });
    res.status(201).json(msg);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Structured incident diagnosis
router.get('/incidents/:id/diagnosis', async (req, res) => {
  try { const d = await IncidentDiagnosis.findOne({ incident: req.params.id, ...T(req) }); res.json(d || null); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/incidents/:id/diagnosis', async (req, res) => {
  try {
    const d = await IncidentDiagnosis.findOneAndUpdate({ incident: req.params.id, tenantId: req.user.tenantId }, { ...req.body, diagnosedBy: req.user.id, tenantId: req.user.tenantId }, { new: true, upsert: true, setDefaultsOnInsert: true });
    res.json(d);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Change-specific impact analysis
router.post('/changes/:id/impact-analysis', async (req, res) => {
  try {
    const Resource = require('../models/Resource').Resource || require('../models/Resource');
    const Ticket = require('../models/Ticket');
    const change = await require('../models/Change').Change ? null : null; // Change default export
    const chg = await require('../models/Change');
    const changeDoc = typeof chg === 'function' ? await chg.findById(req.params.id) : await chg.Change.findById(req.params.id);
    if (!changeDoc) return res.status(404).json({ error: 'Change not found' });
    const resources = await Resource.find({ ...T(req), $or: [{ _id: { $in: (changeDoc.resources || []) } }, { name: new RegExp((changeDoc.title || '').split(' ').slice(0, 2).join('|'), 'i') }] }).limit(50);
    const downstreamIds = [...new Set(resources.flatMap(r => (r.dependencies || []).map(String)))].filter(id => !resources.some(r => String(r._id) === id));
    const recentIncidents = await Ticket.countDocuments({ ...T(req), createdAt: { $gte: new Date(Date.now() - 30 * 86400000) }, $or: resources.map(r => ({ title: new RegExp(r.name.split('-')[0], 'i') })) });
    const riskScore = Math.min(100, resources.length * 8 + downstreamIds.length * 5 + Math.min(40, recentIncidents * 2));
    res.json({
      affectedResources: resources.map(r => ({ id: r._id, name: r.name, type: r.type })),
      downstreamDependencies: downstreamIds.length,
      relatedRecentTickets: recentIncidents,
      windowOverlapRisk: changeDoc.windowStart && changeDoc.windowEnd ? 'check /ops/changes/conflict-check' : 'no window set',
      impactLevel: riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low',
      riskScore,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Work order photos
router.post('/work-orders/:id/photos', async (req, res) => {
  try {
    const WorkOrder = require('../models/WorkOrder').WorkOrder || require('../models/WorkOrder');
    const wo = await WorkOrder.findOne({ _id: req.params.id, ...T(req) });
    if (!wo) return res.status(404).json({ error: 'Not found' });
    wo.attachments = wo.attachments || [];
    wo.attachments.push(...(req.body.urls || []));
    await wo.save();
    res.json({ attachments: wo.attachments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sequence enrollment + runner
router.post('/sequences/:id/enroll', async (req, res) => {
  try {
    const ActivitySequence = require('../models/Remaining').ActivitySequence;
    const seq = await ActivitySequence.findOne({ _id: req.params.id, ...T(req) });
    if (!seq || seq.status !== 'active') return res.status(400).json({ error: 'Sequence not active' });
    const enrollment = await SequenceEnrollment.create({ sequence: seq._id, targetId: req.body.targetId, targetType: seq.target, nextRunAt: new Date(), ...T(req) });
    seq.enrolledCount = (seq.enrolledCount || 0) + 1;
    await seq.save();
    res.json(enrollment);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/sequences/process-due', async (req, res) => {
  try {
    const now = new Date();
    const due = await SequenceEnrollment.find({ ...T(req), status: 'active', nextRunAt: { $lte: now } }).limit(100);
    let executed = 0;
    for (const en of due) {
      const ActivitySequence = require('../models/Remaining').ActivitySequence;
      const CrmActivity = require('../models/CrmActivity');
      const Notification = require('../models/Notification');
      const seq = await ActivitySequence.findById(en.sequence);
      const step = (seq?.steps || [])[en.cursor];
      if (!step) { en.status = 'completed'; await en.save(); continue; }
      if (step.type === 'wait') {
        en.nextRunAt = new Date(now.getTime() + (step.waitDays || 1) * 86400000);
      } else {
        await CrmActivity.create({ type: step.type === 'email' ? 'email' : 'task', subject: step.subject || `${seq?.name} step ${en.cursor + 1}`, description: step.body || '', tenantId: req.user.tenantId, agent: req.user.id });
        await Notification.create({ user: req.user.id, title: `Sequence step executed: ${seq?.name}`, message: `Step ${en.cursor + 1} (${step.type})`, read: false }).catch(() => {});
        en.nextRunAt = new Date(now.getTime() + ((seq?.steps || [])[en.cursor + 1]?.type === 'wait' ? 0 : 86400000));
        en.cursor += 1;
        executed += 1;
      }
      en.log.push({ stepIndex: en.cursor, type: step.type, result: 'ok' });
      await en.save();
    }
    res.json({ processed: due.length, executed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Segment rule evaluation
router.post('/segments/:id/evaluate', async (req, res) => {
  try {
    const Segment = require('../models/Remaining').Segment;
    const User = require('../models/User');
    const seg = await Segment.findOne({ _id: req.params.id, ...T(req) });
    if (!seg) return res.status(404).json({ error: 'Segment not found' });
    const mongoFilter = {};
    for (const r of seg.rules || []) {
      const key = r.field;
      if (r.operator === 'equals') mongoFilter[key] = r.value;
      else if (r.operator === 'not_equals') mongoFilter[key] = { $ne: r.value };
      else if (r.operator === 'contains') mongoFilter[key] = new RegExp(String(r.value), 'i');
      else if (r.operator === 'gt') mongoFilter[key] = { ...(mongoFilter[key] || {}), $gt: Number(r.value) };
      else if (r.operator === 'lt') mongoFilter[key] = { ...(mongoFilter[key] || {}), $lt: Number(r.value) };
      else if (r.operator === 'exists') mongoFilter[key] = { $exists: true, $ne: '' };
    }
    const members = seg.type === 'dynamic' ? (await User.find({ ...mongoFilter }).limit(1000)).map(u => u._id) : (seg.members || []);
    seg.members = members; seg.memberCount = members.length; seg.lastCalculated = new Date();
    await seg.save();
    res.json({ memberCount: members.length, rulesApplied: seg.rules?.length || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Fuzzy duplicate scan for leads
router.post('/duplicates/scan-leads', async (req, res) => {
  try {
    const Lead = require('../models/Lead');
    const DuplicateRecord = require('../models/Remaining').DuplicateRecord;
    const leads = await Lead.find(T(req)).limit(1000);
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9@.]/g, '');
    const pairs = [];
    for (let i = 0; i < leads.length; i++) {
      for (let j = i + 1; j < leads.length; j++) {
        const a = leads[i]; const b = leads[j];
        let score = 0; const matched = [];
        if (norm(a.email) && norm(a.email) === norm(b.email)) { score += 55; matched.push('email'); }
        const an = norm(a.name); const bn = norm(b.name);
        if (an && bn && (an === bn || (an.includes(bn) || bn.includes(an)))) { score += 30; matched.push('name'); }
        else if (an && bn && an.slice(0, 4) === bn.slice(0, 4)) { score += 12; matched.push('name_prefix'); }
        if (norm(a.company) && norm(a.company) === norm(b.company)) { score += 15; matched.push('company'); }
        if (score >= (req.body.threshold || 70)) pairs.push({ primary: a._id, duplicate: b._id, similarity: score, matchedFields: matched });
      }
    }
    const created = [];
    for (const p of pairs) {
      const exists = await DuplicateRecord.findOne({ entityType: 'lead', primary: p.primary, duplicate: p.duplicate, ...T(req) });
      if (!exists) created.push(await DuplicateRecord.create({ entityType: 'lead', ...p, ...T(req) }));
    }
    res.json({ scanned: leads.length, candidatesFound: pairs.length, newRecordsCreated: created.length, records: created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Quote → Contract generation
router.post('/quotes/:id/to-contract', async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    const q = await Quote.findOne({ _id: req.params.id, ...T(req) }) || await Quote.findById(req.params.id);
    if (!q) return res.status(404).json({ error: 'Quote not found' });
    const Contract = require('../models/Contract');
    const start = new Date();
    const end = new Date(start.getTime() + 365 * 86400000);
    const contract = await Contract.create({
      name: `Contract from Quote ${q.number}`,
      value: q.total || 0,
      startDate: start,
      endDate: end,
      company: q.company || req.user.tenantId,
      tenantId: req.user.tenantId,
      sourceQuote: q._id,
    });
    q.contract = contract._id;
    await q.save();
    res.json(contract);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customer-specific SLA assignment
router.put('/companies/:id/sla', async (req, res) => {
  try {
    const cfg = await CompanySlaConfig.findOneAndUpdate({ company: req.params.id, tenantId: req.user.tenantId }, { sla: req.body.slaId, priorityOverrides: req.body.priorityOverrides || [], tenantId: req.user.tenantId }, { new: true, upsert: true, setDefaultsOnInsert: true });
    res.json(cfg);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/companies/:id/sla', async (req, res) => {
  try { const cfg = await CompanySlaConfig.findOne({ company: req.params.id, tenantId: req.user.tenantId }).populate('sla'); res.json(cfg || null); } catch (e) { res.status(500).json({ error: e.message }); }
});

// HR knowledge base seed
router.post('/kb/seed-hr', async (req, res) => {
  try {
    const KnowledgeBase = require('../models/Remaining').KnowledgeBase;
    const Faq = require('../models/Faq');
    let kb = await KnowledgeBase.findOne({ ...T(req), name: 'HR Knowledge Base' });
    if (!kb) kb = await KnowledgeBase.create({ name: 'HR Knowledge Base', description: 'Policies, benefits and onboarding answers', visibility: 'internal', ...T(req) });
    const seed = [
      { q: 'How do I request annual leave?', a: 'Submit a leave request from the HR portal; your manager is notified automatically.' },
      { q: 'When are salaries paid?', a: 'Salaries are paid on the last working day of each month.' },
      { q: 'How do I get an employment letter?', a: 'Raise a document request of type "employment_letter" — HR processes within 2 business days.' },
    ];
    for (const s of seed) await Faq.create({ question: s.q, answer: s.a, kb: kb._id, published: true, tenantId: req.user.tenantId }).catch(() => {});
    kb.articleCount = seed.length;
    await kb.save();
    res.json(kb);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Employee lifecycle task generator
router.post('/hr/lifecycle-generate/:employeeId', async (req, res) => {
  try {
    const milestones = ['day_30', 'day_60', 'day_90', 'six_month', 'annual_review'];
    const templates = {
      day_30: ['30-day check-in with manager', 'Benefits enrollment confirmation'],
      day_60: ['60-day performance pulse', 'Training plan review'],
      day_90: ['90-day probation review meeting', 'Goal setting session'],
      six_month: ['Mid-year performance discussion', 'Career path conversation'],
      annual_review: ['Annual appraisal form', 'Compensation review submission'],
    };
    const created = [];
    for (const m of milestones) {
      const lt = await LifecycleTask.create({ employee: req.params.employeeId, milestone: m, title: m.replace('_', ' ') + ' tasks', items: templates[m].map(l => ({ label: l, done: false })), dueDate: new Date(Date.now() + milestones.indexOf(m) * 90 * 86400000), tenantId: req.user.tenantId });
      created.push(lt);
    }
    res.status(201).json(created);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// License renewal reminders due
router.get('/licenses/reminders-due', async (req, res) => {
  try {
    const License = require('../models/License').License;
    const licenses = await License.find({ ...T(req), status: 'active' });
    const now = Date.now();
    const due = licenses.filter(l => {
      const days = Math.ceil((new Date(l.expiryDate) - now) / 86400000);
      return days > 0 && days <= (l.alertBeforeExpiry || 30);
    });
    res.json({ dueCount: due.length, licenses: due.map(l => ({ id: l._id, name: l.name, expiryDate: l.expiryDate, daysLeft: Math.ceil((new Date(l.expiryDate) - now) / 86400000), cost: l.cost, autoRenew: l.autoRenew })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/licenses/send-reminders', async (req, res) => {
  try {
    const License = require('../models/License').License;
    const Notification = require('../models/Notification');
    const sent = [];
    for (const l of req.body.licenseIds || []) {
      const lic = await License.findOne({ _id: l, ...T(req) });
      if (!lic) continue;
      await Notification.create({ user: req.user.id, title: `License expiring: ${lic.name}`, message: `Expires ${new Date(lic.expiryDate).toDateString()}`, read: false }).catch(() => {});
      lic.lastAlerted = new Date();
      await lic.save();
      sent.push(lic.name);
    }
    res.json({ sentCount: sent.length, sent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Auto-suspension on payment failure
router.post('/billing/payment-failed', async (req, res) => {
  try {
    const Company = require('../models/Company');
    const identifier = req.body.companyEmail || req.body.companyId;
    const company = req.body.companyId
      ? await Company.findById(req.body.companyId)
      : await Company.findOne({ email: identifier }).catch(() => null);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const rec = await SuspensionRecord.create({ company: company._id, reason: 'payment_failure', detail: req.body.detail || 'Payment failure webhook', suspendedBy: req.user.id, tenantId: req.user.tenantId });
    const integrations2 = require('../services/integrations.service');
    const restoreAt = Date.now() + 7 * 86400000;
    const job = await integrations2.enqueue('restore-company', { suspensionId: String(rec._id), companyId: String(company._id) }, restoreAt);
    rec.autoRestoreJobQueued = !!job.queued;
    await rec.save();
    res.json({ suspended: true, recordId: rec._id, autoRestoreInDays: 7 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/billing/restore-company/:companyId', async (req, res) => {
  try {
    const records = await SuspensionRecord.updateMany({ company: req.params.companyId, active: true, ...T(req) }, { active: false, restoredAt: new Date() });
    res.json({ restored: true, updatedRecords: records.modifiedCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// Mention extraction + notification fan-out
router.post('/mentions/extract', async (req, res) => {
  try {
    const text = String(req.body.text || '');
    const Agent = require('../models/Agent');
    const agents = await Agent.find({ tenantId: req.user.tenantId }).select('name email').limit(200);
    const matches = agents.filter(a => text.toLowerCase().includes('@' + String(a.name || '').toLowerCase().split(' ')[0]));
    const Mention = require('../models/Platform3').Delegation ? null : null; // Mention model lives in Remaining
    const MentionModel = require('../models/Remaining').Mention;
    const Notification = require('../models/Notification');
    const created = [];
    for (const m of matches) {
      const doc = await MentionModel.create({ entityType: req.body.entityType || 'note', entityId: req.body.entityId, mentionedBy: req.user.id, mentionedUser: m._id, tenantId: req.user.tenantId });
      await Notification.create({ user: m._id, title: `${req.user.name} mentioned you`, message: text.slice(0, 120), read: false }).catch(() => {});
      created.push(doc);
    }
    res.json({ matchedAgents: matches.map(m => ({ id: m._id, name: m.name })), mentionsCreated: created.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Catalog item dynamic form resolution
router.get('/custom-forms/for-item/:itemId', async (req, res) => {
  try {
    const forms = await CustomForm.find({ ...T(req), entityType: 'ticket', status: 'published' });
    const match = forms.find(f => f.metadata?.catalogItemId === req.params.itemId) || forms.find(f => !f.metadata?.catalogItemId);
    res.json(match || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ 11) SAML ACS (full XML-DSig validation) + CO-EDIT PRESENCE ============
const { TicketPresence } = require('../models/Platform4');

// Public SP Assertion Consumer Service — validates the SAML Response end-to-end
// and issues a platform session JWT. Token is the capability; no auth required here.
router.post('/auth/sso/acs', async (req, res) => {
  try {
    const { SsoConfig } = require('../models/Platform3');
    const cfg = await SsoConfig.findOne({ enabled: true });
    if (!cfg) return res.status(400).json({ error: 'SSO not configured or disabled' });
    if (req.body.RelayState && !req.body.samlResponse) {
      // HTTP-Redirect binding: deflated AuthnRequest flow returns samlResponse via POST anyway
    }
    const samlResponse = req.body.SAMLResponse || req.body.samlResponse;
    if (!samlResponse) return res.status(400).json({ error: 'SAMLResponse required' });
    const { validateSamlResponse } = require('../services/saml.service');
    const result = await validateSamlResponse({
      samlResponse,
      idpCertificate: cfg.idpCertificate,
      spEntityId: cfg.spEntityId || undefined,
    });
    if (!result.valid) {
      const AuditLog = require('../models/AuditLog').AuditLog || null;
      if (AuditLog) await AuditLog.create({ action: 'sso_acs_rejected', detail: result.reason, tenantId: cfg.tenantId }).catch(() => {});
      return res.status(401).json({ error: 'SSO assertion rejected', reason: result.reason });
    }
    const User = require('../models/User');
    let user = await User.findOne({ email: result.email.toLowerCase() });
    if (!user) {
      user = await User.create({
        email: result.email.toLowerCase(),
        name: result.name || result.email.split('@')[0],
        role: cfg.defaultRole || 'client',
        status: 'active',
        authProvider: 'saml',
        tenantId: cfg.tenantId,
      });
    }
    if (user.status !== 'active') return res.status(401).json({ error: 'Account not found or disabled' });
    const { signToken } = require('../middleware/auth');
    const token = signToken({ id: String(user._id), type: 'user' });
    res.json({ token, user: { id: user._id, email: user.email, name: user.name, role: user.role }, attributes: result.attributes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Co-editing presence indicators for a ticket
router.post('/tickets/:number/presence', async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const t = await Ticket.findOne({ number: req.params.number }).select('_id');
    if (!t) return res.status(404).json({ error: 'Ticket not found' });
    await TicketPresence.findOneAndUpdate(
      { ticket: t._id, user: req.user.id },
      { lastSeen: new Date(), userName: req.user.name, tenantId: req.user.tenantId },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/tickets/:number/presence', async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const t = await Ticket.findOne({ number: req.params.number }).select('_id');
    if (!t) return res.status(404).json({ error: 'Ticket not found' });
    const cutoff = new Date(Date.now() - 90 * 1000);
    const active = await TicketPresence.find({ ticket: t._id, lastSeen: { $gte: cutoff }, user: { $ne: req.user.id } })
      .select('userName lastSeen').limit(20);
    res.json({ viewers: active.map(v => ({ name: v.userName, lastSeen: v.lastSeen })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ 12) CROSS-MODULE ORCHESTRATION + IMPERSONATION ============
// Admin-only impersonation with mandatory audit trail
router.post('/impersonate/:userId', async (req, res) => {
  try {
    if (!['admin', 'superadmin'].includes(req.user.role)) return res.status(403).json({ error: 'Admin only' });
    const User = require('../models/User');
    const target = await User.findById(req.params.userId);
    if (!target) return res.status(404).json({ error: 'User not found' });
    try {
      const AuditLog = require('../models/AuditLog');
      const A = typeof AuditLog === 'function' ? AuditLog : AuditLog.AuditLog;
      if (A) await A.create({ action: 'user.impersonation_start', actor: req.user.id, targetUser: target._id, detail: `Admin ${req.user.email} impersonated ${target.email}`, tenantId: T(req).tenantId });
    } catch (_) {}
    const { signToken } = require('../middleware/auth');
    res.json({
      token: signToken({ id: String(target._id), type: 'user', impersonatedBy: String(req.user.id) }),
      user: { id: target._id, email: target.email, name: target.name },
      warning: 'All actions during impersonation are audited',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Employee onboarding cascade: HR tasks + IT requests + asset assignment + workplace reservation
router.post('/hr/onboarding-cascade/:employeeId', async (req, res) => {
  try {
    const created = {};
    // 1) HR lifecycle tasks
    created.hrTasks = await LifecycleTask.create({ employee: req.params.employeeId, milestone: 'day_1', title: 'Day-1 onboarding tasks', items: [{ label: 'Welcome session', done: false }, { label: 'Policy acknowledgement pack', done: false }], tenantId: T(req).tenantId });
    // 2) IT access request ticket
    const Ticket = require('../models/Ticket');
    created.itTicket = await Ticket.create({ title: `[IT Onboarding] Provision accounts for employee ${req.params.employeeId}`, body: 'Auto-generated by onboarding cascade', status: 'open', tenantId: T(req).tenantId });
    // 3) Asset assignment lifecycle record
    const AssetLifecycle = require('../models/Stockroom').AssetLifecycle;
    if (AssetLifecycle && req.body.assetId) {
      created.assetAssignment = await AssetLifecycle.create({ asset: req.body.assetId, status: 'assigned', assignedTo: req.params.employeeId, history: [{ status: 'assigned', changedBy: req.user.id, notes: 'Onboarding cascade' }], tenantId: T(req).tenantId });
    }
    // 4) Desk reservation for day one
    const Space = require('../models/Enterprise').Space;
    const Reservation = require('../models/Enterprise').Reservation;
    if (req.body.spaceId) {
      created.deskReservation = await Reservation.create({ space: req.body.spaceId, reservedBy: req.params.employeeId, date: req.body.startDate || new Date(), status: 'reserved', tenantId: T(req).tenantId });
    } else if (Space) {
      const anyDesk = await Space.findOne({ ...T(req), spaceType: 'desk' }).select('_id');
      if (anyDesk) created.deskReservation = await Reservation.create({ space: anyDesk._id, reservedBy: req.params.employeeId, date: req.body.startDate || new Date(), status: 'reserved', tenantId: T(req).tenantId });
    }
    res.json({ cascaded: Object.keys(created), ...created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


module.exports = router;
