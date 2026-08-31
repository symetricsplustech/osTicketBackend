const express = require('express');
const { License, LicenseAllocation, SoftwareProduct, InstalledSoftware, UsageMeter } = require('../models/License.js');
const { protectTenantAgent } = require('../middleware/auth');
const router = express.Router();
router.use(protectTenantAgent);

// Licenses
router.get('/licenses', async (req, res) => {
  try {
    const { search, status, expiring } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (search) q.$text = { $search: search };
    if (status) q.status = status;
    if (expiring === 'true') {
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      q.expiryDate = { $lte: thirtyDays };
      q.status = 'active';
    }
    const licenses = await License.find(q).sort({ expiryDate: 1 });
    res.json(licenses);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/licenses', async (req, res) => {
  try {
    const license = await License.create({ ...req.body, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(license);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/licenses/:id', async (req, res) => {
  try {
    const license = await License.findOneAndUpdate({ _id: req.params.id, tenantId: req.user.tenantId }, req.body, { new: true });
    if (!license) return res.status(404).json({ error: 'Not found' });
    res.json(license);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/licenses/:id', async (req, res) => {
  try {
    await License.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// License Allocations
router.get('/licenses/:id/allocations', async (req, res) => {
  try {
    const allocations = await LicenseAllocation.find({ license: req.params.id, tenantId: req.user.tenantId })
      .populate('user', 'name email').populate('asset', 'number subject');
    res.json(allocations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/licenses/:id/allocate', async (req, res) => {
  try {
    const license = await License.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!license) return res.status(404).json({ error: 'License not found' });
    if (license.usedSeats >= license.totalSeats) return res.status(400).json({ error: 'No available seats' });
    const allocation = await LicenseAllocation.create({ ...req.body, license: req.params.id, tenantId: req.user.tenantId });
    license.usedSeats += 1;
    await license.save();
    res.status(201).json(allocation);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/allocations/:id', async (req, res) => {
  try {
    const allocation = await LicenseAllocation.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!allocation) return res.status(404).json({ error: 'Not found' });
    allocation.status = 'deactivated';
    allocation.deactivatedDate = new Date();
    await allocation.save();
    await License.findByIdAndUpdate(allocation.license, { $inc: { usedSeats: -1 } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Software Products
router.get('/software', async (req, res) => {
  try {
    const { search, category } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (search) q.$text = { $search: search };
    if (category) q.category = category;
    const software = await SoftwareProduct.find(q).sort({ name: 1 });
    res.json(software);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/software', async (req, res) => {
  try {
    const sw = await SoftwareProduct.create({ ...req.body, tenantId: req.user.tenantId });
    res.status(201).json(sw);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Installed Software
router.get('/installed-software', async (req, res) => {
  try {
    const { asset, software } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (asset) q.asset = asset;
    if (software) q.software = software;
    const items = await InstalledSoftware.find(q).populate('software', 'name vendor');
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/installed-software', async (req, res) => {
  try {
    const item = await InstalledSoftware.create({ ...req.body, tenantId: req.user.tenantId });
    res.status(201).json(item);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Usage Metering
router.get('/usage', async (req, res) => {
  try {
    const { license, startDate, endDate } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (license) q.license = license;
    if (startDate || endDate) {
      q.date = {};
      if (startDate) q.date.$gte = new Date(startDate);
      if (endDate) q.date.$lte = new Date(endDate);
    }
    const usage = await UsageMeter.find(q).populate('license', 'name').populate('user', 'name email');
    res.json(usage);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/usage', async (req, res) => {
  try {
    const usage = await UsageMeter.create({ ...req.body, tenantId: req.user.tenantId });
    res.status(201).json(usage);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Compliance report
router.get('/compliance', async (req, res) => {
  try {
    const licenses = await License.find({ tenantId: req.user.tenantId });
    const report = licenses.map(l => ({
      name: l.name,
      vendor: l.vendor,
      type: l.type,
      totalSeats: l.totalSeats,
      usedSeats: l.usedSeats,
      availableSeats: l.totalSeats - l.usedSeats,
      utilizationPercent: l.totalSeats > 0 ? Math.round((l.usedSeats / l.totalSeats) * 100) : 0,
      expiryDate: l.expiryDate,
      status: l.status,
      daysUntilExpiry: Math.ceil((new Date(l.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)),
      compliance: l.usedSeats <= l.totalSeats ? 'compliant' : 'over_allocated',
    }));
    const summary = {
      totalLicenses: licenses.length,
      totalSeats: licenses.reduce((s, l) => s + l.totalSeats, 0),
      usedSeats: licenses.reduce((s, l) => s + l.usedSeats, 0),
      expiringIn30Days: report.filter(r => r.daysUntilExpiry <= 30 && r.daysUntilExpiry > 0).length,
      overAllocated: report.filter(r => r.compliance === 'over_allocated').length,
    };
    res.json({ summary, licenses: report });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
