const express = require('express');
const { protectAgent } = require('../middleware/auth');
const { moduleRequired } = require('../middleware/module');
const BotFlow = require('../models/BotFlow');
const { findFlows, handleUserInput, invalidateFlows } = require('../services/botFlow.service');

const router = express.Router();

router.use(protectAgent);
router.use(moduleRequired('settings'));

const respondError = (res, e) => {
  const code = Number(e.statusCode) || (e.name === 'ValidationError' || e.name === 'CastError' ? 400 : 500);
  res.status(code).json({ success: false, message: e.message });
};

// GET / — list flows for this tenant
router.get('/', async (req, res) => {
  try {
    const flows = await BotFlow.find({ company: req.companyId }).sort('-updatedAt');
    res.json({ success: true, flows });
  } catch (e) { respondError(res, e); }
});

// POST / — create flow
router.post('/', async (req, res) => {
  try {
    const { name, key, description, trigger, enabled, nodes, startNode } = req.body || {};
    if (!name || !key) return res.status(400).json({ success: false, message: 'name and key are required' });

    const existing = await BotFlow.findOne({ company: req.companyId, key: String(key).trim() });
    if (existing) return res.status(409).json({ success: false, message: 'A flow with this key already exists' });

    const flow = await BotFlow.create({
      company: req.companyId,
      name,
      key: String(key).trim(),
      description: description || '',
      trigger: trigger || '',
      enabled: enabled !== false,
      nodes: Array.isArray(nodes) ? nodes : [],
      startNode: startNode || '',
      createdBy: req.agent?._id || req.user?._id || null,
    });
    invalidateFlows(req.companyId);
    res.status(201).json({ success: true, flow });
  } catch (e) { respondError(res, e); }
});

// PUT /:id — update flow
router.put('/:id', async (req, res) => {
  try {
    const { key, company, ...rest } = req.body || {};
    const update = { ...rest };
    delete update._id;
    delete update.company;
    if (key !== undefined) {
      const trimmed = String(key).trim();
      const dup = await BotFlow.findOne({ company: req.companyId, key: trimmed, _id: { $ne: req.params.id } });
      if (dup) return res.status(409).json({ success: false, message: 'A flow with this key already exists' });
      update.key = trimmed;
    }
    update.updatedBy = req.agent?._id || req.user?._id || null;
    const flow = await BotFlow.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { $set: update },
      { new: true }
    );
    if (!flow) return res.status(404).json({ success: false, message: 'Bot flow not found' });
    invalidateFlows(req.companyId);
    res.json({ success: true, flow });
  } catch (e) { respondError(res, e); }
});

// DELETE /:id — delete flow
router.delete('/:id', async (req, res) => {
  try {
    const flow = await BotFlow.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    if (!flow) return res.status(404).json({ success: false, message: 'Bot flow not found' });
    invalidateFlows(req.companyId);
    res.json({ success: true, message: 'Bot flow deleted' });
  } catch (e) { respondError(res, e); }
});

// POST /:id/duplicate — copy a flow with new key
router.post('/:id/duplicate', async (req, res) => {
  try {
    const original = await BotFlow.findOne({ _id: req.params.id, company: req.companyId }).lean();
    if (!original) return res.status(404).json({ success: false, message: 'Bot flow not found' });

    const newKey = `${original.key}-copy`;
    const dup = await BotFlow.findOne({ company: req.companyId, key: newKey });
    if (dup) return res.status(409).json({ success: false, message: 'A duplicated flow already exists' });

    const { _id, createdAt, updatedAt, ...rest } = original;
    const flow = await BotFlow.create({
      ...rest,
      key: newKey,
      name: `${original.name} (copy)`,
      createdBy: req.agent?._id || req.user?._id || null,
    });
    invalidateFlows(req.companyId);
    res.status(201).json({ success: true, flow });
  } catch (e) { respondError(res, e); }
});

// POST /:id/test — test a flow with sample user text
router.post('/:id/test', async (req, res) => {
  try {
    const { userText } = req.body || {};
    if (!userText) return res.status(400).json({ success: false, message: 'userText is required' });

    const flow = await BotFlow.findOne({ _id: req.params.id, company: req.companyId }).lean();
    if (!flow) return res.status(404).json({ success: false, message: 'Bot flow not found' });

    const result = await handleUserInput(req.companyId, userText, null, {
      flowId: String(flow._id),
      currentNodeId: (flow.startNode || (flow.nodes[0] && flow.nodes[0].id) || ''),
      history: [],
    });
    if (!result) return res.json({ success: true, matched: false });
    res.json({ success: true, matched: true, reply: result.reply, nodeId: result.state?.currentNodeId });
  } catch (e) { respondError(res, e); }
});

module.exports = router;
