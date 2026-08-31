const express = require('express');
const { protectTenantPrincipal, protectAdmin } = require('../middleware/auth');
const SavedPage = require('../models/SavedPage');
const { adapters, listAdapters } = require('../services/erpAdapters');
const pitr = require('../services/pitr.service');
const { UsageMeter, UsageLimit } = require('../models/UsageLimit');

const router = express.Router();
router.use(protectTenantPrincipal);
const T = (req) => ({ tenantId: req.companyId || (req.user && (req.user.tenantId || req.user.companyId)) });

// ==================== ERP Adapters (§17.6) ====================
router.get('/erp/adapters', async (req, res) => {
  try {
    const enabled = listAdapters();
    res.json({ adapters: enabled, count: enabled.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/erp/adapters/:key/test', protectAdmin, async (req, res) => {
  try {
    const adapter = adapters[req.params.key];
    if (!adapter) return res.status(404).json({ error: 'Adapter not enabled or not found' });
    const result = await adapter.health();
    res.json({ adapter: req.params.key, ...result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/erp/adapters/:key/push', protectAdmin, async (req, res) => {
  try {
    const adapter = adapters[req.params.key];
    if (!adapter) return res.status(404).json({ error: 'Adapter not enabled' });
    const { entityType, operation, record } = req.body;
    const result = await adapter.push(entityType, operation, record);
    res.json({ ok: true, result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== RPA / SavedPage (§19.11) ====================
// CRUD
router.get('/saved-pages', async (req, res) => {
  try { res.json(await SavedPage.find(T(req)).sort({ updatedAt: -1 }).limit(100)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/saved-pages/:id', async (req, res) => {
  try {
    const doc = await SavedPage.findOne({ _id: req.params.id, ...T(req) });
    if (!doc) return res.status(404).json({});
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/saved-pages', async (req, res) => {
  try {
    const doc = await SavedPage.create({ ...req.body, ...T(req) });
    res.status(201).json(doc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/saved-pages/:id', async (req, res) => {
  try {
    const doc = await SavedPage.findOneAndUpdate({ _id: req.params.id, ...T(req) }, req.body, { new: true });
    if (!doc) return res.status(404).json({});
    res.json(doc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/saved-pages/:id', async (req, res) => {
  try { await SavedPage.deleteOne({ _id: req.params.id, ...T(req) }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Publish + version snapshot
router.post('/saved-pages/:id/publish', async (req, res) => {
  try {
    const doc = await SavedPage.findOne({ _id: req.params.id, ...T(req) });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    doc.versions.push({ n: doc.versions.length + 1, snapshot: doc.layout, note: req.body.note || '', by: req.user?._id });
    doc.published = true;
    doc.publishedAt = new Date();
    doc.publishedBy = req.user?._id;
    await doc.save();
    res.json({ ok: true, publishedAt: doc.publishedAt, version: doc.versions.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Rollback to version n
router.post('/saved-pages/:id/rollback/:version', async (req, res) => {
  try {
    const doc = await SavedPage.findOne({ _id: req.params.id, ...T(req) });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const v = doc.versions.find((x) => x.n === Number(req.params.version));
    if (!v) return res.status(404).json({ error: 'Version not found' });
    doc.layout = v.snapshot;
    await doc.save();
    res.json({ ok: true, rolledBackTo: v.n });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Public renderer fetch (published pages only; READ-only)
router.get('/saved-pages/render/:slug', async (req, res) => {
  try {
    const doc = await SavedPage.findOne({ slug: req.params.slug, published: true, ...T(req) }).lean();
    if (!doc) return res.status(404).json({ error: 'Page not published or not found' });
    // RBAC check
    if (doc.accessRoles && doc.accessRoles.length && !doc.accessRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Not permitted to view this page' });
    }
    res.json({ slug: doc.slug, name: doc.name, layout: doc.layout, kind: doc.kind });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== PITR Backup (§23.11) ====================
router.post('/pitr/now', protectAdmin, async (req, res) => {
  try {
    const result = await pitr.backupNow(req.companyId);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/pitr/verify/:filename', protectAdmin, async (req, res) => {
  try {
    const result = await pitr.verifyRestore(req.companyId, req.params.filename);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/pitr/history', async (req, res) => {
  try {
    const { BackupTest } = require('../models/Platform5');
    const tests = await BackupTest.find({ tenantId: req.companyId }).sort({ createdAt: -1 }).limit(50);
    res.json(tests);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== Usage Meter / Limits (§1.13) ====================
router.get('/usage/meter', async (req, res) => {
  try {
    const period = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
    const meterDoc = await UsageMeter.findOne({ tenantId: req.companyId, period }).lean();
    const limits = await UsageLimit.find({ tenantId: req.companyId }).lean();
    res.json({ period, meter: meterDoc || {}, limits });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/usage/limits', protectAdmin, async (req, res) => {
  try {
    const { metric, limit, hardBlock } = req.body;
    const doc = await UsageLimit.findOneAndUpdate(
      { tenantId: req.companyId, metric },
      { limit, hardBlock: !!hardBlock },
      { new: true, upsert: true }
    );
    res.json(doc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
