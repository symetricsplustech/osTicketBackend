const express = require('express');
const { protectAgent, protectAdmin } = require('../middleware/auth');
const { moduleRequired } = require('../middleware/module');

const router = express.Router();

// --- HR Cases ---
router.get('/cases', protectAgent, moduleRequired('hr'), async (req, res, next) => {
  try {
    const HrCase = require('../models/HrCase');
    const tenantId = req.user.tenantId || req.user.companyId;
    const { search, status, category } = req.query;
    const query = { company: tenantId };
    if (search) query.$or = [{ title: { $regex: search, $options: 'i' } }, { number: { $regex: search, $options: 'i' } }];
    if (status) query.status = status;
    if (category) query.category = category;
    const cases = await HrCase.find(query).sort('-createdAt').populate('employee', 'name email').populate('assignedTo', 'name');
    res.json({ cases });
  } catch (e) { next(e); }
});

router.get('/cases/:id', protectAgent, moduleRequired('hr'), async (req, res, next) => {
  try {
    const HrCase = require('../models/HrCase');
    const hrCase = await HrCase.findById(req.params.id).populate('employee', 'name email').populate('assignedTo', 'name');
    if (!hrCase) return res.status(404).json({ message: 'HR case not found' });
    res.json({ case: hrCase });
  } catch (e) { next(e); }
});

router.post('/cases', protectAgent, moduleRequired('hr'), async (req, res, next) => {
  try {
    const HrCase = require('../models/HrCase');
    const tenantId = req.user.tenantId || req.user.companyId;
    const count = await HrCase.countDocuments({ company: tenantId });
    const number = `HR-${String(count + 1).padStart(5, '0')}`;
    const hrCase = await HrCase.create({ ...req.body, number, company: tenantId, createdBy: req.user._id });
    res.status(201).json({ case: hrCase });
  } catch (e) { next(e); }
});

router.put('/cases/:id', protectAgent, moduleRequired('hr'), async (req, res, next) => {
  try {
    const HrCase = require('../models/HrCase');
    const hrCase = await HrCase.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!hrCase) return res.status(404).json({ message: 'HR case not found' });
    res.json({ case: hrCase });
  } catch (e) { next(e); }
});

router.post('/cases/:id/thread', protectAgent, moduleRequired('hr'), async (req, res, next) => {
  try {
    const HrCase = require('../models/HrCase');
    const hrCase = await HrCase.findById(req.params.id);
    if (!hrCase) return res.status(404).json({ message: 'HR case not found' });
    hrCase.thread.push({ author: req.user._id, authorModel: 'Agent', content: req.body.content, isInternal: req.body.isInternal || false });
    await hrCase.save();
    res.json({ case: hrCase });
  } catch (e) { next(e); }
});

// --- Leave ---
router.get('/leave', protectAgent, moduleRequired('hr'), async (req, res, next) => {
  try {
    const Leave = require('../models/Leave');
    const tenantId = req.user.tenantId || req.user.companyId;
    const { status, employee } = req.query;
    const query = { company: tenantId };
    if (status) query.status = status;
    if (employee) query.employee = employee;
    const leaves = await Leave.find(query).sort('-createdAt').populate('employee', 'name email');
    res.json({ leaves });
  } catch (e) { next(e); }
});

router.post('/leave', protectAgent, moduleRequired('hr'), async (req, res, next) => {
  try {
    const Leave = require('../models/Leave');
    const tenantId = req.user.tenantId || req.user.companyId;
    const leave = await Leave.create({ ...req.body, company: tenantId, createdBy: req.user._id });
    res.status(201).json({ leave });
  } catch (e) { next(e); }
});

router.put('/leave/:id', protectAgent, moduleRequired('hr'), async (req, res, next) => {
  try {
    const Leave = require('../models/Leave');
    const leave = await Leave.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    res.json({ leave });
  } catch (e) { next(e); }
});

// --- Claims ---
router.get('/claims', protectAgent, moduleRequired('hr'), async (req, res, next) => {
  try {
    const Claim = require('../models/Claim');
    const tenantId = req.user.tenantId || req.user.companyId;
    const { status, employee } = req.query;
    const query = { company: tenantId };
    if (status) query.status = status;
    if (employee) query.employee = employee;
    const claims = await Claim.find(query).sort('-createdAt').populate('employee', 'name email');
    res.json({ claims });
  } catch (e) { next(e); }
});

router.post('/claims', protectAgent, moduleRequired('hr'), async (req, res, next) => {
  try {
    const Claim = require('../models/Claim');
    const tenantId = req.user.tenantId || req.user.companyId;
    const claim = await Claim.create({ ...req.body, company: tenantId, createdBy: req.user._id });
    res.status(201).json({ claim });
  } catch (e) { next(e); }
});

router.put('/claims/:id', protectAgent, moduleRequired('hr'), async (req, res, next) => {
  try {
    const Claim = require('../models/Claim');
    const claim = await Claim.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    res.json({ claim });
  } catch (e) { next(e); }
});

module.exports = router;
