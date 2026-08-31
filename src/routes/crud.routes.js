const express = require('express');
const mongoose = require('mongoose');
const { protectTenantPrincipal } = require('../middleware/auth');
const { resolve, AUTOMATIONS } = require('../core/entityRegistry');

const router = express.Router();
router.use(protectTenantPrincipal);

const T = req => ({ tenantId: req.user.tenantId || req.user.companyId });
const notFound = res => res.status(404).json({ error: 'Record not found' });

// ---- GET /crud/:entity — list with search/filter/sort/pagination/population ----
router.get('/:entity', async (req, res) => {
  try {
    const ent = resolve(req.params.entity);
    if (!ent) return res.status(404).json({ error: `Unknown entity "${req.params.entity}"` });
    const q = { ...T(req) };
    // Filters
    for (const f of (ent.fields || [])) if (req.query[f] !== undefined && req.query[f] !== '') q[f] = req.query[f];
    // Search
    if (req.query.search) {
      const sf = [ent.titleField, ...(ent.numberField ? [ent.numberField] : [])].filter(Boolean);
      q.$or = sf.map(f => ({ [f]: new RegExp(String(req.query.search), 'i') }));
    }
    // Pagination
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit || '25', 10));
    const skip = (page - 1) * limit;
    // Sort
    const sortField = req.query.sortBy || 'createdAt';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;
    // Populate refs
    const populate = Object.keys(ent.refs || {}).map(r => ({ path: r, select: '_id name email title' }));

    const Model = ent.Model;
    const [records, total] = await Promise.all([
      Model.find(q).sort({ [sortField]: sortDir }).skip(skip).limit(limit).populate(populate).lean(),
      Model.countDocuments(q),
    ]);
    res.json({
      records,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      entity: ent.key, label: ent.label,
      fields: ent.fields, refs: Object.keys(ent.refs || {}), editable: ent.editable,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- POST /crud/:entity — create + fire automations ----
router.post('/:entity', async (req, res) => {
  try {
    const ent = resolve(req.params.entity);
    if (!ent) return res.status(404).json({ error: `Unknown entity` });
    const data = { ...req.body, ...T(req) };
    const doc = await ent.Model.create(data);
    // Fire afterCreate automation
    const autoKey = ent.automations || _capFirst(ent.key);
    const autoFn = AUTOMATIONS[autoKey]?.afterCreate;
    if (autoFn) { try { await autoFn(doc, req); } catch (_) {} }
    res.status(201).json({ record: doc.toObject ? doc.toObject() : doc });
  } catch (e) {
    if (e.name === 'ValidationError') return res.status(422).json({ error: e.message, details: e.errors });
    res.status(400).json({ error: e.message });
  }
});

// ---- GET /crud/:entity/:id — read single with populated refs ----
router.get('/:entity/:id', async (req, res) => {
  try {
    const ent = resolve(req.params.entity);
    if (!ent) return notFound(res);
    const populate = Object.keys(ent.refs || {}).map(r => ({ path: r, select: '_id name email title status' }));
    const doc = await ent.Model.findOne({ _id: req.params.id, ...T(req) }).populate(populate).lean();
    if (!doc) return notFound(res);
    res.json({ record: doc, entity: ent.key, label: ent.label, editable: ent.editable, refs: Object.keys(ent.refs || {}) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- PUT /crud/:entity/:id — update + fire automations ----
router.put('/:entity/:id', async (req, res) => {
  try {
    const ent = resolve(req.params.entity);
    if (!ent) return notFound(res);
    const prev = await ent.Model.findOne({ _id: req.params.id, ...T(req) }).lean();
    if (!prev) return notFound(res);
    const doc = await ent.Model.findOneAndUpdate({ _id: req.params.id, ...T(req) }, req.body, { new: true }).lean();
    const autoKey = ent.automations || _capFirst(ent.key);
    const autoFn = AUTOMATIONS[autoKey]?.afterUpdate;
    if (autoFn) { try { await autoFn(doc, prev, req); } catch (_) {} }
    res.json({ record: doc });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- DELETE /crud/:entity/:id ----
router.delete('/:entity/:id', async (req, res) => {
  try {
    const ent = resolve(req.params.entity);
    if (!ent) return notFound(res);
    await ent.Model.deleteOne({ _id: req.params.id, ...T(req) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- GET /crud/:entity/:id/related — related records from connected entities ----
router.get('/:entity/:id/related', async (req, res) => {
  try {
    const ent = resolve(req.params.entity);
    if (!ent) return notFound(res);
    const results = [];
    // Find entities whose ref fields point back at this entity
    const fkMap = {
      ticket: [{ entity: 'task', fk: 'ticket' }, { entity: 'approval', fk: 'entityId' }],
      incident: [{ entity: 'ticket_ci_link', fk: '' }],
      change: [{ entity: 'cab_minute', fk: 'change' }],
      opportunity: [{ entity: 'quote', fk: 'opportunity' }],
      project: [{ entity: 'milestone', fk: 'project' }, { entity: 'timesheet', fk: 'project' }],
      hr_case: [{ entity: 'leave', fk: 'hrCase' }],
    };
    const rels = fkMap[req.params.entity] || [];
    for (const rel of rels) {
      const relEnt = resolve(rel.entity);
      if (!relEnt) continue;
      try {
        const q = { ...T(req) };
        if (rel.fk === 'entityId') q[rel.fk] = mongoose.Types.ObjectId(req.params.id);
        else q[rel.fk] = req.params.id;
        const items = await relEnt.Model.find(q).limit(20).lean();
        if (items.length) results.push({ entity: rel.entity, label: relEnt.label, count: items.length, records: items.slice(0, 10) });
      } catch (_) {}
    }
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- GET /crud/_registry — expose all entity metadata to frontend ----
router.get('/_registry', async (_req, res) => {
  const registry = {};
  for (const [key, def] of Object.entries(require('../core/entityRegistry').ENTITIES)) {
    registry[key] = { label: def.label, fields: def.fields, refs: Object.keys(def.refs || {}), editable: def.editable };
  }
  res.json(registry);
});

function _capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

module.exports = router;
