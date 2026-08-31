const express = require('express');
const { protectTenantPrincipal, protectAdmin } = require('../middleware/auth');
const { Locale, MessageBundle, TenantLocalePreference, UserLocalePreference } = require('../models/Locale');
const { invalidateCache } = require('../middleware/i18n');

const router = express.Router();
router.use(protectTenantPrincipal);
const T = (req) => ({ tenantId: req.companyId || req.user.tenantId || req.user.companyId });

// ---- Public: get messages for a locale/namespace (used by FE to hydrate) ----
router.get('/messages/:locale/:namespace', async (req, res) => {
  try {
    const { locale, namespace } = req.params;
    const query = { locale, namespace };
    const docs = await MessageBundle.find({ ...query, $or: [{ tenantId: null }, T(req)] }).lean();
    const messages = {};
    for (const d of docs) messages[d.key] = d.value;
    res.json({ locale, namespace, messages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- User preference ----
router.get('/me/preference', async (req, res) => {
  try {
    let pref = await UserLocalePreference.findOne({ user: req.user._id }).lean();
    if (!pref) pref = { locale: 'en', timezone: 'UTC' };
    res.json(pref);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/me/preference', async (req, res) => {
  try {
    const pref = await UserLocalePreference.findOneAndUpdate(
      { user: req.user._id },
      { locale: req.body.locale, timezone: req.body.timezone, ...T(req) },
      { new: true, upsert: true }
    );
    res.json(pref);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Admin: locale registry CRUD ----
router.get('/locales', async (req, res) => {
  try { res.json(await Locale.find({}).sort({ code: 1 })); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/locales', protectAdmin, async (req, res) => {
  try { res.status(201).json(await Locale.create(req.body)); } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/locales/:id', protectAdmin, async (req, res) => {
  try {
    const doc = await Locale.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Admin: message bundle management ----
router.get('/messages', async (req, res) => {
  try {
    const q = {};
    if (req.query.locale) q.locale = req.query.locale;
    if (req.query.namespace) q.namespace = req.query.namespace;
    res.json(await MessageBundle.find(q).limit(1000).lean());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/messages', protectAdmin, async (req, res) => {
  try {
    const doc = await MessageBundle.findOneAndUpdate(
      { locale: req.body.locale, namespace: req.body.namespace, key: req.body.key },
      { value: req.body.value, tenantId: req.body.tenantId || null },
      { new: true, upsert: true }
    );
    invalidateCache();
    res.status(201).json(doc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/messages/import', protectAdmin, async (req, res) => {
  try {
    // body: { locale, namespace, messages: { key: value } }
    const { locale, namespace, messages } = req.body;
    const ops = Object.entries(messages || {}).map(([key, value]) => ({
      updateOne: {
        filter: { locale, namespace, key },
        update: { $set: { value } },
        upsert: true,
      },
    }));
    const result = await MessageBundle.bulkWrite(ops);
    invalidateCache();
    res.json({ upserted: result.upsertedCount, modified: result.modifiedCount });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Admin: tenant preference ----
router.get('/tenant/preference', protectAdmin, async (req, res) => {
  try {
    let pref = await TenantLocalePreference.findOne(T(req)).lean();
    if (!pref) pref = { defaultLocale: 'en', supportedLocales: ['en'], fallbackLocale: 'en', timezone: 'UTC' };
    res.json(pref);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/tenant/preference', protectAdmin, async (req, res) => {
  try {
    const pref = await TenantLocalePreference.findOneAndUpdate(
      T(req),
      req.body,
      { new: true, upsert: true }
    );
    res.json(pref);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
