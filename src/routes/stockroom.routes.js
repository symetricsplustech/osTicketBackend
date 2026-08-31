const express = require('express');
const { Stockroom, StockItem, Procurement, Repair, AssetLifecycle, Loaner, Replacement } = require('../models/Stockroom.js');
const { protectTenantAgent } = require('../middleware/auth');
const router = express.Router();
router.use(protectTenantAgent);

// Stockrooms
router.get('/stockrooms', async (req, res) => {
  try {
    const stockrooms = await Stockroom.find({ tenantId: req.user.tenantId });
    res.json(stockrooms);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/stockrooms', async (req, res) => {
  try {
    const stockroom = await Stockroom.create({ ...req.body, tenantId: req.user.tenantId });
    res.status(201).json(stockroom);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Stock Items
router.get('/stock-items', async (req, res) => {
  try {
    const { stockroom, lowStock } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (stockroom) q.stockroom = stockroom;
    if (lowStock === 'true') q.$expr = { $lte: ['$quantity', '$reorderLevel'] };
    const items = await StockItem.find(q).populate('product', 'name sku').populate('stockroom', 'name');
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/stock-items', async (req, res) => {
  try {
    const item = await StockItem.create({ ...req.body, tenantId: req.user.tenantId });
    res.status(201).json(item);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/stock-items/:id', async (req, res) => {
  try {
    const item = await StockItem.findOneAndUpdate({ _id: req.params.id, tenantId: req.user.tenantId }, req.body, { new: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Procurement
router.get('/procurement', async (req, res) => {
  try {
    const { status } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (status) q.status = status;
    const orders = await Procurement.find(q).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/procurement', async (req, res) => {
  try {
    const number = `PO-${Date.now().toString(36).toUpperCase()}`;
    const order = await Procurement.create({ ...req.body, number, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(order);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/procurement/:id/approve', async (req, res) => {
  try {
    const order = await Procurement.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, status: 'pending_approval' },
      { status: 'approved', approvedBy: req.user.id, approvedAt: new Date() },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Not found or not pending approval' });
    res.json(order);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/procurement/:id/receive', async (req, res) => {
  try {
    const order = await Procurement.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, status: 'ordered' },
      { status: 'received', receivedAt: new Date(), receivedQuantity: req.body.receivedQuantity || req.body.quantity },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Not found or not ordered' });
    res.json(order);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Repairs
router.get('/repairs', async (req, res) => {
  try {
    const { asset, status } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (asset) q.asset = asset;
    if (status) q.status = status;
    const repairs = await Repair.find(q).sort({ createdAt: -1 });
    res.json(repairs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/repairs', async (req, res) => {
  try {
    const repair = await Repair.create({ ...req.body, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(repair);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Asset Lifecycle
router.get('/asset-lifecycle', async (req, res) => {
  try {
    const { status } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (status) q.status = status;
    const lifecycle = await AssetLifecycle.find(q).populate('asset', 'number subject');
    res.json(lifecycle);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/asset-lifecycle', async (req, res) => {
  try {
    const lifecycle = await AssetLifecycle.create({
      ...req.body,
      tenantId: req.user.tenantId,
      history: [{ status: req.body.status || 'requested', changedBy: req.user.id, notes: 'Created' }],
    });
    res.status(201).json(lifecycle);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/asset-lifecycle/:id/transition', async (req, res) => {
  try {
    const lifecycle = await AssetLifecycle.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!lifecycle) return res.status(404).json({ error: 'Not found' });
    const validTransitions = {
      requested: ['approved', 'cancelled'],
      approved: ['ordered', 'cancelled'],
      ordered: ['received', 'cancelled'],
      received: ['in_stock'],
      in_stock: ['assigned'],
      assigned: ['in_use', 'maintenance', 'retired'],
      in_use: ['maintenance', 'retired'],
      maintenance: ['in_use', 'retired'],
      retired: ['disposed'],
    };
    const allowed = validTransitions[lifecycle.status] || [];
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ error: `Cannot transition from ${lifecycle.status} to ${req.body.status}` });
    }
    lifecycle.status = req.body.status;
    lifecycle.history.push({ status: req.body.status, changedBy: req.user.id, notes: req.body.notes });
    if (req.body.status === 'retired') lifecycle.disposedAt = new Date();
    await lifecycle.save();
    res.json(lifecycle);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Loaners
router.get('/loaners', async (req, res) => {
  try {
    const { status } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (status) q.status = status;
    const loaners = await Loaner.find(q).populate('asset', 'number subject').populate('loanedTo', 'name email');
    res.json(loaners);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/loaners', async (req, res) => {
  try {
    const loaner = await Loaner.create({ ...req.body, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(loaner);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/loaners/:id/return', async (req, res) => {
  try {
    const loaner = await Loaner.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, status: 'active' },
      { status: 'returned', actualReturnDate: new Date(), condition: req.body.condition },
      { new: true }
    );
    if (!loaner) return res.status(404).json({ error: 'Not found or not active' });
    res.json(loaner);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
