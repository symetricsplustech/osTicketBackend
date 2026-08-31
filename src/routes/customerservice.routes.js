const express = require('express');
const { Complaint, Refund, Order, ContactRole, CompanyHierarchy } = require('../models/CustomerService.js');
const { protectTenantAgent } = require('../middleware/auth');
const router = express.Router();
router.use(protectTenantAgent);

// Complaints
router.get('/complaints', async (req, res) => {
  try {
    const { status, severity, customer } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (status) q.status = status;
    if (severity) q.severity = severity;
    if (customer) q.customer = customer;
    const complaints = await Complaint.find(q).populate('customer', 'name email').populate('assignedTo', 'name').sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/complaints', async (req, res) => {
  try {
    const number = `CMP-${Date.now().toString(36).toUpperCase()}`;
    const complaint = await Complaint.create({ ...req.body, number, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(complaint);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/complaints/:id', async (req, res) => {
  try {
    const complaint = await Complaint.findOneAndUpdate({ _id: req.params.id, tenantId: req.user.tenantId }, req.body, { new: true });
    if (!complaint) return res.status(404).json({ error: 'Not found' });
    res.json(complaint);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/complaints/:id/thread', async (req, res) => {
  try {
    const complaint = await Complaint.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!complaint) return res.status(404).json({ error: 'Not found' });
    complaint.thread.push({ author: req.user.id, message: req.body.message });
    await complaint.save();
    res.json(complaint);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Refunds
router.get('/refunds', async (req, res) => {
  try {
    const { status } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (status) q.status = status;
    const refunds = await Refund.find(q).populate('customer', 'name email').sort({ createdAt: -1 });
    res.json(refunds);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/refunds', async (req, res) => {
  try {
    const number = `REF-${Date.now().toString(36).toUpperCase()}`;
    const refund = await Refund.create({ ...req.body, number, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(refund);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/refunds/:id/approve', async (req, res) => {
  try {
    const refund = await Refund.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, status: 'pending' },
      { status: 'approved', approvedBy: req.user.id, approvedAt: new Date() },
      { new: true }
    );
    if (!refund) return res.status(404).json({ error: 'Not found or not pending' });
    res.json(refund);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/refunds/:id/process', async (req, res) => {
  try {
    const refund = await Refund.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, status: 'approved' },
      { status: 'processed', processedAt: new Date() },
      { new: true }
    );
    if (!refund) return res.status(404).json({ error: 'Not found or not approved' });
    res.json(refund);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Orders
router.get('/orders', async (req, res) => {
  try {
    const { status, customer } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (status) q.status = status;
    if (customer) q.customer = customer;
    const orders = await Order.find(q).populate('customer', 'name email').sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/orders', async (req, res) => {
  try {
    const number = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const order = await Order.create({ ...req.body, number, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(order);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate({ _id: req.params.id, tenantId: req.user.tenantId }, req.body, { new: true });
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Contact Roles
router.get('/contact-roles', async (req, res) => {
  try {
    const { company } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (company) q.company = company;
    const roles = await ContactRole.find(q).populate('user', 'name email');
    res.json(roles);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/contact-roles', async (req, res) => {
  try {
    const role = await ContactRole.create({ ...req.body, tenantId: req.user.tenantId });
    res.status(201).json(role);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Company Hierarchy
router.get('/company-hierarchy', async (req, res) => {
  try {
    const hierarchy = await CompanyHierarchy.find({ tenantId: req.user.tenantId });
    res.json(hierarchy);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/company-hierarchy', async (req, res) => {
  try {
    const h = await CompanyHierarchy.create({ ...req.body, tenantId: req.user.tenantId });
    if (req.body.parentCompany) {
      await CompanyHierarchy.findOneAndUpdate(
        { company: req.body.parentCompany, tenantId: req.user.tenantId },
        { $push: { childCompanies: req.body.company } }
      );
    }
    res.status(201).json(h);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
