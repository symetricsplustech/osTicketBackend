const express = require('express');
const { protectAgent, protectAdmin } = require('../middleware/auth');
const { moduleRequired } = require('../middleware/module');

const router = express.Router();

// --- Resources ---
router.get('/resources', protectAgent, moduleRequired('itom'), async (req, res, next) => {
  try {
    const Resource = require('../models/Resource');
    const tenantId = req.user.tenantId || req.user.companyId;
    const { search, type, status } = req.query;
    const query = { company: tenantId };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { hostname: { $regex: search, $options: 'i' } }];
    if (type) query.type = type;
    if (status) query.status = status;
    const resources = await Resource.find(query).sort('-createdAt').populate('owner', 'name');
    res.json({ resources });
  } catch (e) { next(e); }
});

router.get('/resources/:id', protectAgent, moduleRequired('itom'), async (req, res, next) => {
  try {
    const Resource = require('../models/Resource');
    const resource = await Resource.findById(req.params.id).populate('owner', 'name').populate('dependencies', 'name type status');
    if (!resource) return res.status(404).json({ message: 'Resource not found' });
    res.json({ resource });
  } catch (e) { next(e); }
});

router.post('/resources', protectAgent, moduleRequired('itom'), async (req, res, next) => {
  try {
    const Resource = require('../models/Resource');
    const tenantId = req.user.tenantId || req.user.companyId;
    const resource = await Resource.create({ ...req.body, company: tenantId, createdBy: req.user._id });
    res.status(201).json({ resource });
  } catch (e) { next(e); }
});

router.put('/resources/:id', protectAgent, moduleRequired('itom'), async (req, res, next) => {
  try {
    const Resource = require('../models/Resource');
    const resource = await Resource.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!resource) return res.status(404).json({ message: 'Resource not found' });
    res.json({ resource });
  } catch (e) { next(e); }
});

router.delete('/resources/:id', protectAgent, moduleRequired('itom'), async (req, res, next) => {
  try {
    const Resource = require('../models/Resource');
    await Resource.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// --- Alerts ---
router.get('/alerts', protectAgent, moduleRequired('itom'), async (req, res, next) => {
  try {
    const Alert = require('../models/Alert');
    const tenantId = req.user.tenantId || req.user.companyId;
    const { status, severity, resource } = req.query;
    const query = { company: tenantId };
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (resource) query.resource = resource;
    const alerts = await Alert.find(query).sort('-createdAt').populate('resource', 'name type').populate('acknowledgedBy', 'name');
    res.json({ alerts });
  } catch (e) { next(e); }
});

router.post('/alerts', protectAgent, moduleRequired('itom'), async (req, res, next) => {
  try {
    const Alert = require('../models/Alert');
    const tenantId = req.user.tenantId || req.user.companyId;
    const alert = await Alert.create({ ...req.body, company: tenantId, createdBy: req.user._id });
    res.status(201).json({ alert });
  } catch (e) { next(e); }
});

router.put('/alerts/:id', protectAgent, moduleRequired('itom'), async (req, res, next) => {
  try {
    const Alert = require('../models/Alert');
    const alert = await Alert.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json({ alert });
  } catch (e) { next(e); }
});

router.post('/alerts/:id/acknowledge', protectAgent, moduleRequired('itom'), async (req, res, next) => {
  try {
    const Alert = require('../models/Alert');
    const alert = await Alert.findByIdAndUpdate(req.params.id, { status: 'acknowledged', acknowledgedBy: req.user._id, acknowledgedAt: new Date() }, { new: true });
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json({ alert });
  } catch (e) { next(e); }
});

router.post('/alerts/:id/resolve', protectAgent, moduleRequired('itom'), async (req, res, next) => {
  try {
    const Alert = require('../models/Alert');
    const alert = await Alert.findByIdAndUpdate(req.params.id, { status: 'resolved', resolvedAt: new Date() }, { new: true });
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json({ alert });
  } catch (e) { next(e); }
});

// --- Service Map ---
router.get('/service-map', protectAgent, moduleRequired('itom'), async (req, res, next) => {
  try {
    const Resource = require('../models/Resource');
    const tenantId = req.user.tenantId || req.user.companyId;
    const resources = await Resource.find({ company: tenantId }).select('name type status dependencies dependents location');
    res.json({ resources });
  } catch (e) { next(e); }
});

module.exports = router;
