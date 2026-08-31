const express = require('express');
const { protectAgent, protectAdmin } = require('../middleware/auth');
const { moduleRequired } = require('../middleware/module');

const router = express.Router();

// --- Work Orders ---
router.get('/', protectAgent, moduleRequired('field-service'), async (req, res, next) => {
  try {
    const WorkOrder = require('../models/WorkOrder');
    const tenantId = req.user.tenantId || req.user.companyId;
    const { search, status, assignedTo, scheduledDate } = req.query;
    const query = { company: tenantId };
    if (search) query.$or = [{ title: { $regex: search, $options: 'i' } }, { number: { $regex: search, $options: 'i' } }];
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;
    if (scheduledDate) {
      const d = new Date(scheduledDate);
      query.scheduledDate = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
    }
    const workOrders = await WorkOrder.find(query).sort('-scheduledDate').populate('assignedTo', 'name').populate('customer', 'name email');
    res.json({ workOrders });
  } catch (e) { next(e); }
});

router.get('/calendar', protectAgent, moduleRequired('field-service'), async (req, res, next) => {
  try {
    const WorkOrder = require('../models/WorkOrder');
    const tenantId = req.user.tenantId || req.user.companyId;
    const { start, end } = req.query;
    const query = { company: tenantId, scheduledDate: { $gte: new Date(start), $lte: new Date(end) } };
    const workOrders = await WorkOrder.find(query).populate('assignedTo', 'name').populate('customer', 'name');
    res.json({ workOrders });
  } catch (e) { next(e); }
});

router.get('/:id', protectAgent, moduleRequired('field-service'), async (req, res, next) => {
  try {
    const WorkOrder = require('../models/WorkOrder');
    const wo = await WorkOrder.findById(req.params.id).populate('assignedTo', 'name email').populate('customer', 'name email phone').populate('ticket', 'number title');
    if (!wo) return res.status(404).json({ message: 'Work order not found' });
    res.json({ workOrder: wo });
  } catch (e) { next(e); }
});

router.post('/', protectAgent, moduleRequired('field-service'), async (req, res, next) => {
  try {
    const WorkOrder = require('../models/WorkOrder');
    const tenantId = req.user.tenantId || req.user.companyId;
    const count = await WorkOrder.countDocuments({ company: tenantId });
    const number = `WO-${String(count + 1).padStart(5, '0')}`;
    const wo = await WorkOrder.create({ ...req.body, number, company: tenantId, createdBy: req.user._id });
    res.status(201).json({ workOrder: wo });
  } catch (e) { next(e); }
});

router.put('/:id', protectAgent, moduleRequired('field-service'), async (req, res, next) => {
  try {
    const WorkOrder = require('../models/WorkOrder');
    const wo = await WorkOrder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!wo) return res.status(404).json({ message: 'Work order not found' });
    res.json({ workOrder: wo });
  } catch (e) { next(e); }
});

router.put('/:id/start', protectAgent, moduleRequired('field-service'), async (req, res, next) => {
  try {
    const WorkOrder = require('../models/WorkOrder');
    const wo = await WorkOrder.findByIdAndUpdate(req.params.id, { status: 'in_progress', startedAt: new Date() }, { new: true });
    if (!wo) return res.status(404).json({ message: 'Work order not found' });
    res.json({ workOrder: wo });
  } catch (e) { next(e); }
});

router.put('/:id/complete', protectAgent, moduleRequired('field-service'), async (req, res, next) => {
  try {
    const WorkOrder = require('../models/WorkOrder');
    const wo = await WorkOrder.findByIdAndUpdate(req.params.id, { status: 'completed', completedAt: new Date(), customerSignature: req.body.customerSignature || '' }, { new: true });
    if (!wo) return res.status(404).json({ message: 'Work order not found' });
    res.json({ workOrder: wo });
  } catch (e) { next(e); }
});

router.post('/:id/tasks', protectAgent, moduleRequired('field-service'), async (req, res, next) => {
  try {
    const WorkOrder = require('../models/WorkOrder');
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).json({ message: 'Work order not found' });
    wo.tasks.push(req.body);
    await wo.save();
    res.json({ workOrder: wo });
  } catch (e) { next(e); }
});

router.put('/:id/tasks/:taskIdx', protectAgent, moduleRequired('field-service'), async (req, res, next) => {
  try {
    const WorkOrder = require('../models/WorkOrder');
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).json({ message: 'Work order not found' });
    const idx = Number(req.params.taskIdx);
    if (idx < 0 || idx >= wo.tasks.length) return res.status(400).json({ message: 'Invalid task index' });
    Object.assign(wo.tasks[idx], req.body);
    await wo.save();
    res.json({ workOrder: wo });
  } catch (e) { next(e); }
});

router.post('/:id/time', protectAgent, moduleRequired('field-service'), async (req, res, next) => {
  try {
    const WorkOrder = require('../models/WorkOrder');
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).json({ message: 'Work order not found' });
    wo.timeEntries.push({ agent: req.user._id, ...req.body });
    wo.totalCost = wo.timeEntries.reduce((s, t) => s + (t.hours || 0) * 50, 0) + wo.parts.reduce((s, p) => s + (p.cost || 0) * (p.quantity || 1), 0);
    await wo.save();
    res.json({ workOrder: wo });
  } catch (e) { next(e); }
});

router.delete('/:id', protectAgent, moduleRequired('field-service'), async (req, res, next) => {
  try {
    const WorkOrder = require('../models/WorkOrder');
    await WorkOrder.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
