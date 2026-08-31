const express = require('express');
const { WorkflowExecutionLog, FeatureFlag, Invitation, IncidentPlaybook, OnCallSchedule } = require('../models/WorkflowExecutionLog.js');
const { ScheduledReport } = require('../models/ScheduledReport.js');
const { protectTenantAgent } = require('../middleware/auth');
const router = express.Router();
router.use(protectTenantAgent);

// Workflow Execution Logs
router.get('/workflow-logs', async (req, res) => {
  try {
    const { workflow, status, trigger } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (workflow) q.workflow = workflow;
    if (status) q.status = status;
    if (trigger) q.trigger = trigger;
    const logs = await WorkflowExecutionLog.find(q)
      .populate('workflow', 'name')
      .sort({ startedAt: -1 })
      .limit(100);
    res.json(logs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/workflow-logs/:id', async (req, res) => {
  try {
    const log = await WorkflowExecutionLog.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
      .populate('workflow', 'name description');
    if (!log) return res.status(404).json({ error: 'Not found' });
    res.json(log);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/workflow-logs/:id/retry', async (req, res) => {
  try {
    const original = await WorkflowExecutionLog.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!original) return res.status(404).json({ error: 'Not found' });
    if (original.status !== 'failed') return res.status(400).json({ error: 'Only failed logs can be retried' });
    const retry = await WorkflowExecutionLog.create({
      workflow: original.workflow,
      trigger: original.trigger,
      triggerData: original.triggerData,
      status: 'running',
      retryOf: original._id,
      tenantId: req.user.tenantId,
      createdBy: req.user.id,
      steps: original.steps.map(s => ({ ...s, status: 'pending', retryCount: 0 })),
    });
    original.status = 'retrying';
    await original.save();
    res.status(201).json(retry);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Feature Flags
router.get('/feature-flags', async (req, res) => {
  try {
    const flags = await FeatureFlag.find({ tenantId: req.user.tenantId }).sort({ name: 1 });
    res.json(flags);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/feature-flags', async (req, res) => {
  try {
    const flag = await FeatureFlag.create({ ...req.body, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(flag);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/feature-flags/:id', async (req, res) => {
  try {
    const flag = await FeatureFlag.findOneAndUpdate({ _id: req.params.id, tenantId: req.user.tenantId }, req.body, { new: true });
    if (!flag) return res.status(404).json({ error: 'Not found' });
    res.json(flag);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/feature-flags/:id/toggle', async (req, res) => {
  try {
    const flag = await FeatureFlag.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!flag) return res.status(404).json({ error: 'Not found' });
    flag.enabled = !flag.enabled;
    await flag.save();
    res.json(flag);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/feature-flags/check/:name', async (req, res) => {
  try {
    const flag = await FeatureFlag.findOne({ name: req.params.name, tenantId: req.user.tenantId });
    if (!flag) return res.json({ enabled: false });
    if (!flag.enabled) return res.json({ enabled: false });
    if (flag.type === 'boolean') return res.json({ enabled: true });
    if (flag.type === 'percentage') {
      const hash = (req.user.id + flag.name).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      return res.json({ enabled: hash % 100 < flag.percentage });
    }
    if (flag.type === 'user_list') {
      return res.json({ enabled: flag.allowedUsers.includes(req.user.id) });
    }
    res.json({ enabled: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Invitations
router.get('/invitations', async (req, res) => {
  try {
    const { status } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (status) q.status = status;
    const invitations = await Invitation.find(q).populate('invitedBy', 'name email').sort({ createdAt: -1 });
    res.json(invitations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/invitations', async (req, res) => {
  try {
  // Plan contact-seat enforcement
  try {
    const PlanP = require('../models/Plan');
    const plan0 = (await PlanP.find({}).limit(1))[0];
    if (plan0 && plan0.maxContacts != null) {
      const UC = require('../models/User');
      const usedC = await UC.countDocuments({ tenantId: req.user.tenantId || req.user.companyId, role: 'client' }).catch(function() { return 0; });
      if (usedC >= plan0.maxContacts) { return res.status(402).json({ error: 'Contact seat limit reached (' + plan0.maxContacts + ')' }); }
    }
  } catch (e0) {}
    const crypto = (function(){ const m = require('crypto'); return m.default !== undefined ? m : m; })();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const invitation = await Invitation.create({
      ...req.body,
      token,
      expiresAt,
      invitedBy: req.user.id,
      tenantId: req.user.tenantId,
    });
    res.status(201).json(invitation);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/invitations/:token/accept', async (req, res) => {
  try {
    const invitation = await Invitation.findOne({ token: req.params.token, status: 'pending' });
    if (!invitation) return res.status(404).json({ error: 'Invalid or expired invitation' });
    if (invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      await invitation.save();
      return res.status(400).json({ error: 'Invitation expired' });
    }
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    await invitation.save();
    res.json({ success: true, email: invitation.email, role: invitation.role, modules: invitation.modules });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/invitations/:id', async (req, res) => {
  try {
    const invitation = await Invitation.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, status: 'pending' },
      { status: 'cancelled' },
      { new: true }
    );
    if (!invitation) return res.status(404).json({ error: 'Not found or not pending' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Incident Playbooks
router.get('/playbooks', async (req, res) => {
  try {
    const { category, severity } = req.query;
    const q = { tenantId: req.user.tenantId };
    if (category) q.category = category;
    if (severity) q.severity = severity;
    const playbooks = await IncidentPlaybook.find(q).sort({ name: 1 });
    res.json(playbooks);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/playbooks', async (req, res) => {
  try {
    const playbook = await IncidentPlaybook.create({ ...req.body, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(playbook);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/playbooks/:id', async (req, res) => {
  try {
    const playbook = await IncidentPlaybook.findOneAndUpdate({ _id: req.params.id, tenantId: req.user.tenantId }, req.body, { new: true });
    if (!playbook) return res.status(404).json({ error: 'Not found' });
    res.json(playbook);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/playbooks/:id', async (req, res) => {
  try {
    await IncidentPlaybook.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/playbooks/:id/use', async (req, res) => {
  try {
    const playbook = await IncidentPlaybook.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!playbook) return res.status(404).json({ error: 'Not found' });
    playbook.lastUsedAt = new Date();
    playbook.useCount += 1;
    await playbook.save();
    res.json(playbook);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// On-Call Schedules
router.get('/oncall', async (req, res) => {
  try {
    const schedules = await OnCallSchedule.find({ tenantId: req.user.tenantId })
      .populate('rotations.agent', 'name email')
      .populate('escalation.agent', 'name email');
    res.json(schedules);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/oncall', async (req, res) => {
  try {
    const schedule = await OnCallSchedule.create({ ...req.body, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(schedule);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/oncall/:id', async (req, res) => {
  try {
    const schedule = await OnCallSchedule.findOneAndUpdate({ _id: req.params.id, tenantId: req.user.tenantId }, req.body, { new: true });
    if (!schedule) return res.status(404).json({ error: 'Not found' });
    res.json(schedule);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/oncall/:id/escalate', async (req, res) => {
  try {
    const schedule = await OnCallSchedule.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!schedule) return res.status(404).json({ error: 'Not found' });
    const now = new Date();
    const currentOnCall = schedule.escalation.find(e => {
      const rot = schedule.rotations.find(r => r.agent.toString() === e.agent.toString());
      return rot && rot.startDate <= now && rot.endDate >= now;
    });
    if (currentOnCall) {
      res.json({ currentOnCall: currentOnCall.agent, escalation: schedule.escalation });
    } else {
      res.json({ currentOnCall: null, escalation: schedule.escalation });
    }
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Scheduled Reports
router.get('/scheduled-reports', async (req, res) => {
  try {
    const reports = await ScheduledReport.find({ tenantId: req.user.tenantId }).sort({ name: 1 });
    res.json(reports);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/scheduled-reports', async (req, res) => {
  try {
    const report = await ScheduledReport.create({ ...req.body, tenantId: req.user.tenantId, createdBy: req.user.id });
    res.status(201).json(report);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/scheduled-reports/:id', async (req, res) => {
  try {
    const report = await ScheduledReport.findOneAndUpdate({ _id: req.params.id, tenantId: req.user.tenantId }, req.body, { new: true });
    if (!report) return res.status(404).json({ error: 'Not found' });
    res.json(report);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/scheduled-reports/:id', async (req, res) => {
  try {
    await ScheduledReport.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/scheduled-reports/:id/run', async (req, res) => {
  try {
    const report = await ScheduledReport.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!report) return res.status(404).json({ error: 'Not found' });
    report.lastRunAt = new Date();
    report.runCount += 1;
    await report.save();
    res.json({ success: true, message: 'Report queued for generation' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
