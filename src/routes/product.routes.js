const express = require('express');
const { Product, Service, CustomerService, InstalledProduct } = require('../models/Product.js');
const { protectTenantAgent } = require('../middleware/auth');
const router = express.Router();
router.use(protectTenantAgent);

// Products
router.get('/products', async (req, res) => {
  try {
    const { search, category, status } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (search) q.$text = { $search: search };
    if (category) q.category = category;
    if (status) q.status = status;
    const products = await Product.find(q).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/products', async (req, res) => {
  try {
    const product = await Product.create({ ...req.body, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(product);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/products/:id', async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate({ _id: req.params.id, tenantId: req.user.tenantId }, req.body, { new: true });
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await Product.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Services
router.get('/services', async (req, res) => {
  try {
    const { search, category, status } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (search) q.$text = { $search: search };
    if (category) q.category = category;
    if (status) q.status = status;
    const services = await Service.find(q).sort({ createdAt: -1 });
    res.json(services);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/services', async (req, res) => {
  try {
    const service = await Service.create({ ...req.body, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(service);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/services/:id', async (req, res) => {
  try {
    const service = await Service.findOneAndUpdate({ _id: req.params.id, tenantId: req.user.tenantId }, req.body, { new: true });
    if (!service) return res.status(404).json({ error: 'Not found' });
    res.json(service);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/services/:id', async (req, res) => {
  try {
    await Service.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Customer Services (subscriptions)
router.get('/customer-services', async (req, res) => {
  try {
    const { customer, status } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (customer) q.customer = customer;
    if (status) q.status = status;
    const subs = await CustomerService.find(q).populate('customer', 'name email').populate('service', 'name');
    res.json(subs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/customer-services', async (req, res) => {
  try {
    const sub = await CustomerService.create({ ...req.body, tenantId: req.user.tenantId });
    res.status(201).json(sub);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Installed Products
router.get('/installed-products', async (req, res) => {
  try {
    const { customer, product } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (customer) q.customer = customer;
    if (product) q.product = product;
    const items = await InstalledProduct.find(q).populate('product', 'name category').populate('customer', 'name email');
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/installed-products', async (req, res) => {
  try {
    const item = await InstalledProduct.create({ ...req.body, tenantId: req.user.tenantId });
    res.status(201).json(item);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
