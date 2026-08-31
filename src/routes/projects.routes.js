const express = require('express');
const { protectAgent, protectAdmin } = require('../middleware/auth');
const { moduleRequired } = require('../middleware/module');

const router = express.Router();

// --- Projects ---
router.get('/', protectAgent, moduleRequired('projects'), async (req, res, next) => {
  try {
    const Project = require('../models/Project');
    const tenantId = req.user.tenantId || req.user.companyId;
    const { search, status } = req.query;
    const query = { company: tenantId };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }];
    if (status) query.status = status;
    const projects = await Project.find(query).sort('-createdAt').populate('owner', 'name').populate('manager', 'name');
    res.json({ projects });
  } catch (e) { next(e); }
});

router.get('/:id', protectAgent, moduleRequired('projects'), async (req, res, next) => {
  try {
    const Project = require('../models/Project');
    const project = await Project.findById(req.params.id).populate('owner', 'name').populate('manager', 'name').populate('team', 'name');
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ project });
  } catch (e) { next(e); }
});

router.post('/', protectAgent, moduleRequired('projects'), async (req, res, next) => {
  try {
    const Project = require('../models/Project');
    const tenantId = req.user.tenantId || req.user.companyId;
    const project = await Project.create({ ...req.body, company: tenantId, createdBy: req.user._id });
    res.status(201).json({ project });
  } catch (e) { next(e); }
});

router.put('/:id', protectAgent, moduleRequired('projects'), async (req, res, next) => {
  try {
    const Project = require('../models/Project');
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ project });
  } catch (e) { next(e); }
});

router.delete('/:id', protectAgent, moduleRequired('projects'), async (req, res, next) => {
  try {
    const Project = require('../models/Project');
    await Project.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// --- Milestones ---
router.get('/:projectId/milestones', protectAgent, moduleRequired('projects'), async (req, res, next) => {
  try {
    const Milestone = require('../models/Milestone');
    const milestones = await Milestone.find({ project: req.params.projectId }).sort('order');
    res.json({ milestones });
  } catch (e) { next(e); }
});

router.post('/:projectId/milestones', protectAgent, moduleRequired('projects'), async (req, res, next) => {
  try {
    const Milestone = require('../models/Milestone');
    const tenantId = req.user.tenantId || req.user.companyId;
    const milestone = await Milestone.create({ ...req.body, project: req.params.projectId, company: tenantId, createdBy: req.user._id });
    res.status(201).json({ milestone });
  } catch (e) { next(e); }
});

// --- Tasks ---
router.get('/:projectId/tasks', protectAgent, moduleRequired('projects'), async (req, res, next) => {
  try {
    const ProjectTask = require('../models/ProjectTask');
    const { status, assignedTo } = req.query;
    const query = { project: req.params.projectId };
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;
    const tasks = await ProjectTask.find(query).sort('order').populate('assignedTo', 'name').populate('milestone', 'name');
    res.json({ tasks });
  } catch (e) { next(e); }
});

router.post('/:projectId/tasks', protectAgent, moduleRequired('projects'), async (req, res, next) => {
  try {
    const ProjectTask = require('../models/ProjectTask');
    const tenantId = req.user.tenantId || req.user.companyId;
    const task = await ProjectTask.create({ ...req.body, project: req.params.projectId, company: tenantId, createdBy: req.user._id });
    res.status(201).json({ task });
  } catch (e) { next(e); }
});

router.put('/:projectId/tasks/:taskId', protectAgent, moduleRequired('projects'), async (req, res, next) => {
  try {
    const ProjectTask = require('../models/ProjectTask');
    const task = await ProjectTask.findByIdAndUpdate(req.params.taskId, req.body, { new: true });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ task });
  } catch (e) { next(e); }
});

router.delete('/:projectId/tasks/:taskId', protectAgent, moduleRequired('projects'), async (req, res, next) => {
  try {
    const ProjectTask = require('../models/ProjectTask');
    await ProjectTask.findByIdAndDelete(req.params.taskId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
