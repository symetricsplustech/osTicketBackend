const express = require('express');
const { TicketTemplate, RecurringRequest, RequestedItem, PostImplReview, KnowledgeBase, Outage, ChangeCalendar, MonitoringTicket, PriceBook, ActivitySequence, Segment, SalesForecast, DuplicateRecord, ProjectTemplate, ProjectIssue, ProjectDocument, Timesheet, ProjectRisk, HrRequestCatalogue, OnboardingChecklist, DepartmentTransfer, DocumentRequest, PolicyAcknowledgement, HrDocument, PreventiveMaintenance, Branch, Address, Mention, DeviceSession, CustomReport, DashboardConfig } = require('../models/Remaining.js');
const { protectTenantAgent } = require('../middleware/auth');
const router = express.Router();
router.use(protectTenantAgent);

// === HELP DESK REMAINING ===

// Ticket Templates
router.get('/templates', async (req, res) => {
  try { const t = await TicketTemplate.find({ tenantId: req.user.tenantId }); res.json(t); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/templates', async (req, res) => {
  try { const t = await TicketTemplate.create({...req.body, tenantId: req.user.tenantId, createdBy: req.user.id}); res.status(201).json(t); } catch(e) { res.status(400).json({error:e.message}); }
});

// Recurring Requests
router.get('/recurring-requests', async (req, res) => {
  try { const r = await RecurringRequest.find({ tenantId: req.user.tenantId }); res.json(r); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/recurring-requests', async (req, res) => {
  try { const r = await RecurringRequest.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(r); } catch(e) { res.status(400).json({error:e.message}); }
});

// Requested Items (RITM)
router.get('/ritms', async (req, res) => {
  try { const r = await RequestedItem.find({ tenantId: req.user.tenantId }).populate('requester', 'name email'); res.json(r); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/ritms', async (req, res) => {
  try { const number = `RITM-${Date.now().toString(36).toUpperCase()}`; const r = await RequestedItem.create({...req.body, number, tenantId: req.user.tenantId}); res.status(201).json(r); } catch(e) { res.status(400).json({error:e.message}); }
});
router.put('/ritms/:id/fulfill', async (req, res) => {
  try { const r = await RequestedItem.findOneAndUpdate({_id: req.params.id, tenantId: req.user.tenantId}, {status: 'fulfilled', fulfilledAt: new Date()}, {new: true}); res.json(r); } catch(e) { res.status(400).json({error:e.message}); }
});

// PIR
router.get('/pir', async (req, res) => {
  try { const p = await PostImplReview.find({ tenantId: req.user.tenantId }).populate('change', 'title'); res.json(p); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/pir', async (req, res) => {
  try { const p = await PostImplReview.create({...req.body, tenantId: req.user.tenantId, createdBy: req.user.id}); res.status(201).json(p); } catch(e) { res.status(400).json({error:e.message}); }
});
router.put('/pir/:id', async (req, res) => {
  try { const p = await PostImplReview.findOneAndUpdate({_id: req.params.id, tenantId: req.user.tenantId}, req.body, {new: true}); res.json(p); } catch(e) { res.status(400).json({error:e.message}); }
});

// Knowledge Bases
router.get('/knowledge-bases', async (req, res) => {
  try { const k = await KnowledgeBase.find({ tenantId: req.user.tenantId }); res.json(k); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/knowledge-bases', async (req, res) => {
  try { const k = await KnowledgeBase.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(k); } catch(e) { res.status(400).json({error:e.message}); }
});

// Outages
router.get('/outages', async (req, res) => {
  try { const o = await Outage.find({ tenantId: req.user.tenantId }).sort({startedAt: -1}); res.json(o); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/outages', async (req, res) => {
  try { const o = await Outage.create({...req.body, tenantId: req.user.tenantId, createdBy: req.user.id}); res.status(201).json(o); } catch(e) { res.status(400).json({error:e.message}); }
});
router.put('/outages/:id', async (req, res) => {
  try { const o = await Outage.findOneAndUpdate({_id: req.params.id, tenantId: req.user.tenantId}, req.body, {new: true}); res.json(o); } catch(e) { res.status(400).json({error:e.message}); }
});
router.post('/outages/:id/timeline', async (req, res) => {
  try { const o = await Outage.findOne({_id: req.params.id, tenantId: req.user.tenantId}); if(!o) return res.status(404).json({error:'Not found'}); o.timeline.push({status: req.body.status, message: req.body.message, by: req.user.id}); await o.save(); res.json(o); } catch(e) { res.status(400).json({error:e.message}); }
});

// Change Calendar
router.get('/change-calendar', async (req, res) => {
  try { const c = await ChangeCalendar.find({ tenantId: req.user.tenantId }); res.json(c); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/change-calendar', async (req, res) => {
  try { const c = await ChangeCalendar.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(c); } catch(e) { res.status(400).json({error:e.message}); }
});

// Monitoring-to-Ticket
router.post('/monitoring/webhook', async (req, res) => {
  try {
    const { source, alertId, alertData, resource } = req.body;
    const ticket = await require('../models/Ticket').default.create({
      title: `[${source}] ${alertData?.title || 'Monitoring Alert'}`,
      body: JSON.stringify(alertData),
      source: 'monitoring',
      tenantId: req.user?.tenantId || 'system',
      status: 'open',
    });
    const m = await MonitoringTicket.create({ source, alertId, ticket: ticket._id, resource, alertData, status: 'ticket_created', tenantId: req.user?.tenantId || 'system' });
    res.status(201).json({ ticket, monitoring: m });
  } catch(e) { res.status(400).json({error:e.message}); }
});

// === CRM REMAINING ===

// Price Books
router.get('/price-books', async (req, res) => {
  try { const p = await PriceBook.find({ tenantId: req.user.tenantId }); res.json(p); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/price-books', async (req, res) => {
  try { const p = await PriceBook.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(p); } catch(e) { res.status(400).json({error:e.message}); }
});

// Activity Sequences
router.get('/sequences', async (req, res) => {
  try { const s = await ActivitySequence.find({ tenantId: req.user.tenantId }); res.json(s); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/sequences', async (req, res) => {
  try { const s = await ActivitySequence.create({...req.body, tenantId: req.user.tenantId, createdBy: req.user.id}); res.status(201).json(s); } catch(e) { res.status(400).json({error:e.message}); }
});

// Segments
router.get('/segments', async (req, res) => {
  try { const s = await Segment.find({ tenantId: req.user.tenantId }); res.json(s); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/segments', async (req, res) => {
  try { const s = await Segment.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(s); } catch(e) { res.status(400).json({error:e.message}); }
});

// Sales Forecasts
router.get('/forecasts', async (req, res) => {
  try { const f = await SalesForecast.find({ tenantId: req.user.tenantId }).sort({startDate: -1}); res.json(f); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/forecasts', async (req, res) => {
  try { const f = await SalesForecast.create({...req.body, tenantId: req.user.tenantId, createdBy: req.user.id}); res.status(201).json(f); } catch(e) { res.status(400).json({error:e.message}); }
});

// Duplicate Detection
router.get('/duplicates', async (req, res) => {
  try { const d = await DuplicateRecord.find({ tenantId: req.user.tenantId, status: 'pending' }); res.json(d); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/duplicates/:id/merge', async (req, res) => {
  try { const d = await DuplicateRecord.findOneAndUpdate({_id: req.params.id, tenantId: req.user.tenantId}, {status: 'merged', mergedAt: new Date()}, {new: true}); res.json(d); } catch(e) { res.status(400).json({error:e.message}); }
});
router.post('/duplicates/:id/dismiss', async (req, res) => {
  try { const d = await DuplicateRecord.findOneAndUpdate({_id: req.params.id, tenantId: req.user.tenantId}, {status: 'dismissed'}, {new: true}); res.json(d); } catch(e) { res.status(400).json({error:e.message}); }
});

// === PROJECTS REMAINING ===

// Project Templates
router.get('/project-templates', async (req, res) => {
  try { const t = await ProjectTemplate.find({ tenantId: req.user.tenantId }); res.json(t); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/project-templates', async (req, res) => {
  try { const t = await ProjectTemplate.create({...req.body, tenantId: req.user.tenantId, createdBy: req.user.id}); res.status(201).json(t); } catch(e) { res.status(400).json({error:e.message}); }
});

// Project Issues
router.get('/project-issues', async (req, res) => {
  try { const {project} = req.query; const q = {tenantId: req.user.tenantId}; if(project) q.project = project; const i = await ProjectIssue.find(q).sort({createdAt:-1}); res.json(i); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/project-issues', async (req, res) => {
  try { const i = await ProjectIssue.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(i); } catch(e) { res.status(400).json({error:e.message}); }
});

// Project Documents
router.get('/project-documents', async (req, res) => {
  try { const {project} = req.query; const q = {tenantId: req.user.tenantId}; if(project) q.project = project; const d = await ProjectDocument.find(q); res.json(d); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/project-documents', async (req, res) => {
  try { const d = await ProjectDocument.create({...req.body, tenantId: req.user.tenantId, uploadedBy: req.user.id}); res.status(201).json(d); } catch(e) { res.status(400).json({error:e.message}); }
});

// Timesheets
router.get('/timesheets', async (req, res) => {
  try { const {agent, startDate, endDate} = req.query; const q = {tenantId: req.user.tenantId}; if(agent) q.agent = agent; if(startDate||endDate) { q.date = {}; if(startDate) q.date.$gte = new Date(startDate); if(endDate) q.date.$lte = new Date(endDate); } const t = await Timesheet.find(q).populate('agent', 'name'); res.json(t); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/timesheets', async (req, res) => {
  try { const t = await Timesheet.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(t); } catch(e) { res.status(400).json({error:e.message}); }
});
router.post('/timesheets/:id/approve', async (req, res) => {
  try { const t = await Timesheet.findOneAndUpdate({_id: req.params.id, tenantId: req.user.tenantId}, {status: 'approved', approvedBy: req.user.id, approvedAt: new Date()}, {new: true}); res.json(t); } catch(e) { res.status(400).json({error:e.message}); }
});

// Project Risks
router.get('/project-risks', async (req, res) => {
  try { const {project} = req.query; const q = {tenantId: req.user.tenantId}; if(project) q.project = project; const r = await ProjectRisk.find(q); res.json(r); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/project-risks', async (req, res) => {
  try { const r = await ProjectRisk.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(r); } catch(e) { res.status(400).json({error:e.message}); }
});

// === HR REMAINING ===

// HR Request Catalogue
router.get('/hr-catalogue', async (req, res) => {
  try { const h = await HrRequestCatalogue.find({ tenantId: req.user.tenantId }); res.json(h); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/hr-catalogue', async (req, res) => {
  try { const h = await HrRequestCatalogue.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(h); } catch(e) { res.status(400).json({error:e.message}); }
});

// Onboarding
router.get('/onboarding', async (req, res) => {
  try { const o = await OnboardingChecklist.find({ tenantId: req.user.tenantId }).populate('employee', 'name email'); res.json(o); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/onboarding', async (req, res) => {
  try { const o = await OnboardingChecklist.create({...req.body, tenantId: req.user.tenantId, createdBy: req.user.id}); res.status(201).json(o); } catch(e) { res.status(400).json({error:e.message}); }
});
router.put('/onboarding/:id/tasks/:taskIdx', async (req, res) => {
  try { const o = await OnboardingChecklist.findOne({_id: req.params.id, tenantId: req.user.tenantId}); if(!o) return res.status(404).json({error:'Not found'}); o.tasks[req.params.taskIdx].status = req.body.status; if(req.body.status==='completed') o.tasks[req.params.taskIdx].completedAt = new Date(); await o.save(); res.json(o); } catch(e) { res.status(400).json({error:e.message}); }
});

// Department Transfers
router.get('/transfers', async (req, res) => {
  try { const t = await DepartmentTransfer.find({ tenantId: req.user.tenantId }).populate('employee', 'name email'); res.json(t); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/transfers', async (req, res) => {
  try { const t = await DepartmentTransfer.create({...req.body, tenantId: req.user.tenantId, createdBy: req.user.id}); res.status(201).json(t); } catch(e) { res.status(400).json({error:e.message}); }
});

// Document Requests
router.get('/document-requests', async (req, res) => {
  try { const d = await DocumentRequest.find({ tenantId: req.user.tenantId }).populate('employee', 'name email'); res.json(d); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/document-requests', async (req, res) => {
  try { const d = await DocumentRequest.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(d); } catch(e) { res.status(400).json({error:e.message}); }
});
router.put('/document-requests/:id/process', async (req, res) => {
  try { const d = await DocumentRequest.findOneAndUpdate({_id: req.params.id, tenantId: req.user.tenantId}, {status: req.body.status, deliveredAt: req.body.status==='delivered' ? new Date() : undefined}, {new: true}); res.json(d); } catch(e) { res.status(400).json({error:e.message}); }
});

// Policy Acknowledgements
router.get('/policies', async (req, res) => {
  try { const p = await PolicyAcknowledgement.find({ tenantId: req.user.tenantId }).populate('employee', 'name email'); res.json(p); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/policies', async (req, res) => {
  try { const p = await PolicyAcknowledgement.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(p); } catch(e) { res.status(400).json({error:e.message}); }
});
router.post('/policies/:id/acknowledge', async (req, res) => {
  try { const p = await PolicyAcknowledgement.findOneAndUpdate({_id: req.params.id, tenantId: req.user.tenantId}, {acknowledged: true, acknowledgedAt: new Date()}, {new: true}); res.json(p); } catch(e) { res.status(400).json({error:e.message}); }
});

// HR Documents
router.get('/hr-documents', async (req, res) => {
  try { const {employee} = req.query; const q = {tenantId: req.user.tenantId}; if(employee) q.employee = employee; const d = await HrDocument.find(q); res.json(d); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/hr-documents', async (req, res) => {
  try { const d = await HrDocument.create({...req.body, tenantId: req.user.tenantId, uploadedBy: req.user.id}); res.status(201).json(d); } catch(e) { res.status(400).json({error:e.message}); }
});

// === FIELD SERVICE REMAINING ===

// Preventive Maintenance
router.get('/preventive-maintenance', async (req, res) => {
  try { const p = await PreventiveMaintenance.find({ tenantId: req.user.tenantId }); res.json(p); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/preventive-maintenance', async (req, res) => {
  try { const p = await PreventiveMaintenance.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(p); } catch(e) { res.status(400).json({error:e.message}); }
});

// === SHARED PLATFORM REMAINING ===

// Branches
router.get('/branches', async (req, res) => {
  try { const b = await Branch.find({ tenantId: req.user.tenantId }); res.json(b); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/branches', async (req, res) => {
  try { const b = await Branch.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(b); } catch(e) { res.status(400).json({error:e.message}); }
});

// Addresses
router.get('/addresses', async (req, res) => {
  try { const {entity, entityId} = req.query; const q = {tenantId: req.user.tenantId}; if(entity) q.entity = entity; if(entityId) q.entityId = entityId; const a = await Address.find(q); res.json(a); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/addresses', async (req, res) => {
  try { const a = await Address.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(a); } catch(e) { res.status(400).json({error:e.message}); }
});

// Mentions
router.get('/mentions', async (req, res) => {
  try { const m = await Mention.find({ mentionedUser: req.user.id, tenantId: req.user.tenantId, read: false }).populate('mentionedBy', 'name'); res.json(m); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/mentions', async (req, res) => {
  try { const m = await Mention.create({...req.body, mentionedBy: req.user.id, tenantId: req.user.tenantId}); res.status(201).json(m); } catch(e) { res.status(400).json({error:e.message}); }
});
router.post('/mentions/:id/read', async (req, res) => {
  try { const m = await Mention.findOneAndUpdate({_id: req.params.id, tenantId: req.user.tenantId}, {read: true, readAt: new Date()}, {new: true}); res.json(m); } catch(e) { res.status(400).json({error:e.message}); }
});

// Device Sessions
router.get('/device-sessions', async (req, res) => {
  try { const d = await DeviceSession.find({ user: req.user.id, tenantId: req.user.tenantId }); res.json(d); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/device-sessions', async (req, res) => {
  try { const d = await DeviceSession.create({...req.body, user: req.user.id, tenantId: req.user.tenantId}); res.status(201).json(d); } catch(e) { res.status(400).json({error:e.message}); }
});
router.delete('/device-sessions/:id', async (req, res) => {
  try { await DeviceSession.findOneAndUpdate({_id: req.params.id, tenantId: req.user.tenantId}, {status: 'revoked'}); res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }
});

// === ANALYTICS REMAINING ===

// Custom Reports
router.get('/custom-reports', async (req, res) => {
  try { const r = await CustomReport.find({ tenantId: req.user.tenantId }); res.json(r); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/custom-reports', async (req, res) => {
  try { const r = await CustomReport.create({...req.body, tenantId: req.user.tenantId, createdBy: req.user.id}); res.status(201).json(r); } catch(e) { res.status(400).json({error:e.message}); }
});

// Dashboard Configs
router.get('/dashboard-configs', async (req, res) => {
  try { const d = await DashboardConfig.find({ tenantId: req.user.tenantId }); res.json(d); } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/dashboard-configs', async (req, res) => {
  try { const d = await DashboardConfig.create({...req.body, tenantId: req.user.tenantId}); res.status(201).json(d); } catch(e) { res.status(400).json({error:e.message}); }
});
router.put('/dashboard-configs/:id', async (req, res) => {
  try { const d = await DashboardConfig.findOneAndUpdate({_id: req.params.id, tenantId: req.user.tenantId}, req.body, {new: true}); res.json(d); } catch(e) { res.status(400).json({error:e.message}); }
});

// CRM Reports endpoints
router.get('/reports/leads-by-source', async (req, res) => {
  try { const { Lead } = (function(){ const m = require('../models/Lead.js'); return m.default !== undefined ? m : m; })(); const r = await Lead.aggregate([{$match:{tenantId:req.user.tenantId}}, {$group:{_id:'$source',count:{$sum:1}}}, {$sort:{count:-1}}]); res.json(r); } catch(e) { res.status(500).json({error:e.message}); }
});
router.get('/reports/conversion', async (req, res) => {
  try { const { Lead } = (function(){ const m = require('../models/Lead.js'); return m.default !== undefined ? m : m; })(); const total = await Lead.countDocuments({tenantId:req.user.tenantId}); const converted = await Lead.countDocuments({tenantId:req.user.tenantId, status:'converted'}); res.json({total, converted, rate: total>0 ? Math.round((converted/total)*100) : 0}); } catch(e) { res.status(500).json({error:e.message}); }
});
router.get('/reports/pipeline-value', async (req, res) => {
  try { const { Opportunity } = (function(){ const m = require('../models/Opportunity.js'); return m.default !== undefined ? m : m; })(); const r = await Opportunity.aggregate([{$match:{tenantId:req.user.tenantId}}, {$group:{_id:'$stage',count:{$sum:1},value:{$sum:'$value'}}}, {$sort:{value:-1}}]); res.json(r); } catch(e) { res.status(500).json({error:e.message}); }
});
router.get('/reports/won-lost', async (req, res) => {
  try { const { Opportunity } = (function(){ const m = require('../models/Opportunity.js'); return m.default !== undefined ? m : m; })(); const won = await Opportunity.countDocuments({tenantId:req.user.tenantId, stage:'closed_won'}); const lost = await Opportunity.countDocuments({tenantId:req.user.tenantId, stage:'closed_lost'}); res.json({won, lost, winRate: (won+lost)>0 ? Math.round((won/(won+lost))*100) : 0}); } catch(e) { res.status(500).json({error:e.message}); }
});
router.get('/reports/agent-performance', async (req, res) => {
  try { const { default: Ticket } = (function(){ const m = require('../models/Ticket.js'); return m.default !== undefined ? m : m; })(); const r = await Ticket.aggregate([{$match:{tenantId:req.user.tenantId}}, {$group:{_id:'$assignedTo',total:{$sum:1},closed:{$sum:{$cond:[{$eq:['$status','closed']},1,0]}}}}, {$sort:{total:-1}}]); res.json(r); } catch(e) { res.status(500).json({error:e.message}); }
});

module.exports = router;
