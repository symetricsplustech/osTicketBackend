const express = require('express');
const { protectTenantPrincipal, requirePermission } = require('../middleware/auth');
const { moduleRequired } = require('../middleware/module');
const { upload, scanUploads } = require('../config/multer');
const ctrl = require('../controllers/agent.controller');
const assistCtrl = require('../controllers/assist.controller');

const router = express.Router();

router.use(protectTenantPrincipal);
router.use((req, res, next) => {
  if (!req.agent) {
    const principal = req.user || req.superAdmin;
    const isSuperAdmin = !!req.superAdmin;
    req.agent = {
      _id: principal._id,
      name: principal.name,
      email: principal.email,
      isAdmin: true,
      isSuperAdmin,
      company: req.companyId || null,
      departments: [],
      teams: [],
      permissions: isSuperAdmin ? ['*'] : [],
      role: { isAdmin: true },
    };
  }
  next();
});

// Dashboard & queues
router.get('/dashboard', ctrl.dashboard);
router.get('/queues', ctrl.queues);
router.get('/directory', ctrl.agentDirectory);
router.get('/directory/users', ctrl.directoryUsers);

// Notifications
router.get('/notifications', ctrl.notifications);
router.put('/notifications/read', ctrl.markNotificationsRead);
router.put('/notifications/:id/read', ctrl.markNotificationRead);

// Tickets (guarded by helpdesk module)
router.get('/tickets', moduleRequired('helpdesk'), ctrl.listTickets);
router.post('/tickets', moduleRequired('helpdesk'), ctrl.create);
router.get('/tickets/export', ctrl.exportTickets);
router.get('/tickets/sla/predictions', moduleRequired('helpdesk'), async (req, res, next) => {
  try {
    const { predictBreachMany } = require('../services/slaPredictor.service');
    const result = await predictBreachMany({ company: req.companyId, limit: parseInt(req.query.limit, 10) || 50 });
    res.json(result);
  } catch (e) { next(e); }
});
router.get('/tickets/:number/sla-history', require('../controllers/admin.controller').ticketSlaHistory);
router.get('/tickets/:number', ctrl.getTicket);
router.post('/tickets/:number/reply', upload.array('files', 5), scanUploads, ctrl.reply);
router.post('/tickets/:number/note', ctrl.addNote);
router.post('/tickets/:number/assign', ctrl.assign);
router.post('/tickets/:number/claim', ctrl.claim);
router.post('/tickets/:number/transfer', ctrl.transfer);
router.post('/tickets/:number/status', ctrl.changeStatus);
router.post('/tickets/:number/fields', ctrl.updateFields);
router.post('/tickets/:number/collaborators', ctrl.addCollaborator);
router.delete('/tickets/:number/collaborators/:userId', ctrl.removeCollaborator);
router.post('/tickets/:number/lock', ctrl.lockTicket);
router.post('/tickets/:number/unlock', ctrl.unlockTicket);
router.post('/tickets/:number/delete', ctrl.deleteTicket);
router.post('/tickets/:number/merge', ctrl.mergeTickets);
router.post('/tickets/:number/split', ctrl.splitTicket);
router.put('/tickets/:number/threads/:threadId', ctrl.updateThread);
router.delete('/tickets/:number/threads/:threadId', ctrl.deleteThread);
router.post('/tickets/:number/sla/pause', ctrl.pauseSla);
router.post('/tickets/:number/sla/resume', ctrl.resumeSla);
router.post('/tickets/:number/sla/predict', moduleRequired('helpdesk'), async (req, res, next) => {
  try {
    const { predictBreach } = require('../services/slaPredictor.service');
    const ticket = await require('../models/Ticket').findOne({ number: String(req.params.number).toUpperCase(), company: req.companyId }).lean();
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const result = await predictBreach({ company: req.companyId, ticketId: ticket._id });
    res.json(result);
  } catch (e) { next(e); }
});
router.get('/queues/saved', ctrl.listSavedQueues);
router.post('/queues/saved', ctrl.createSavedQueue);
router.delete('/queues/saved/:id', ctrl.deleteSavedQueue);
router.post('/tickets/:number/tasks', ctrl.addTask);
router.put('/tickets/:number/tasks/:taskId', ctrl.updateTask);

// Assistant (tenant-learned triage + summarization, MD ITSM-02/15)
router.post('/tickets/suggest', moduleRequired('helpdesk'), assistCtrl.suggestTriage);
router.get('/tickets/suggest-refs', moduleRequired('helpdesk'), assistCtrl.suggestRefs);
router.post('/assist/summarize', moduleRequired('helpdesk'), assistCtrl.summarize);

// Supervision
router.get('/workload', ctrl.workload);
router.get('/escalations', ctrl.listEscalations);
router.post('/escalations', requirePermission('escalations.manage'), ctrl.createEscalation);
router.put('/escalations/:id', requirePermission('escalations.manage'), ctrl.updateEscalation);
router.delete('/escalations/:id', requirePermission('escalations.manage'), ctrl.deleteEscalation);

// Users & organizations
router.get('/users', ctrl.listUsers);
router.post('/users', ctrl.createUser);
router.get('/users/:id', ctrl.getUser);
router.get('/orgs', ctrl.listOrgs);
router.post('/orgs', ctrl.createOrg);
router.get('/orgs/:id', ctrl.getOrg);

// Knowledgebase (canned + faq) management
router.get('/canned', ctrl.listCanned);
router.post('/canned', ctrl.createCanned);
router.put('/canned/:id', ctrl.updateCanned);
router.delete('/canned/:id', ctrl.deleteCanned);
router.post('/canned/:id/render', ctrl.renderCanned);
router.get('/kb/suggest', require('../controllers/kb.controller').suggestForAgent);
router.get('/faq-categories', ctrl.listFaqCategories);
router.post('/faq-categories', ctrl.createFaqCategory);
router.get('/faqs', ctrl.listFaqs);
router.post('/faqs', ctrl.createFaq);
router.put('/faqs/:id', ctrl.updateFaq);
router.post('/faqs/:id/transition', ctrl.transitionFaq);
router.delete('/faqs/:id', ctrl.deleteFaq);

// KB deflection metric
router.get('/kb/deflection', moduleRequired('helpdesk'), async (req, res, next) => {
  try {
    const Faq = require('../models/Faq');
    const faqId = req.query.faqId;
    const periodDays = parseInt(req.query.periodDays, 10) || 30;
    const since = new Date(Date.now() - periodDays * 86400000);
    const q = { company: req.companyId, isPublished: true };
    if (faqId) q._id = faqId;
    const faqs = await Faq.find(q).select('subject views votesUp votesDown').lean();
    const stats = faqs.map(f => ({
      faqId: f._id,
      subject: f.subject,
      views: f.views || 0,
      votesUp: f.votesUp || 0,
      votesDown: f.votesDown || 0,
      deflectionRate: f.views ? Math.round(((f.votesUp || 0) / f.views) * 100) : 0,
    }));
    const totalViews = stats.reduce((a, s) => a + s.views, 0);
    const totalDeflected = stats.reduce((a, s) => a + s.votesUp, 0);
    res.json({ totalViews, totalDeflected, overallDeflectionRate: totalViews ? Math.round((totalDeflected / totalViews) * 100) : 0, articles: stats });
  } catch (e) { next(e); }
});

// Announcements
router.get('/announcements', ctrl.listAnnouncements);
router.post('/announcements', ctrl.createAnnouncement);
router.delete('/announcements/:id', ctrl.deleteAnnouncement);

module.exports = router;
