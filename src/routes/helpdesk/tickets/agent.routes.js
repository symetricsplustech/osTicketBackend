const express = require('express');
const { protectTenantPrincipal, requirePermission } = require('../../../middleware/auth');
const { moduleRequired } = require('../../../middleware/module');
const { upload, scanUploads } = require('../../../config/multer');
const ctrl = require('../../../controllers/helpdesk');
const assistCtrl = require('../../../controllers/helpdesk/tickets/assist.controller');
const incidentRoutes = require('../incidents');
const userRoutes = require('../users');
const knowledgeRoutes = require('../knowledge/agent.routes');

const router = express.Router();

router.use(protectTenantPrincipal);
router.use((req, res, next) => {
  if (!req.agent) {
    return res.status(403).json({ error: 'Agent access required' });
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
router.get('/tickets/sla/predictions', moduleRequired('helpdesk'), requirePermission('tickets.view'), async (req, res, next) => {
  try {
    const { predictBreachMany } = require('../../../services/slaPredictor.service');
    const { scopeTicketQuery } = require('../../../controllers/helpdesk');
    const result = await predictBreachMany({ company: req.companyId, limit: parseInt(req.query.limit, 10) || 50, scope: scopeTicketQuery(req.agent) });
    res.json(result);
  } catch (e) { next(e); }
});
router.get('/search/semantic', moduleRequired('helpdesk'), async (req, res, next) => {
  try {
    const { semanticSearch } = require('../../../services/neuralSearch.service');
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [], query: q });
    const results = await semanticSearch({ company: req.companyId, query: q, limit: parseInt(req.query.limit, 10) || 30, userId: req.user._id });
    res.json({ results, query: q });
  } catch (e) { next(e); }
});
router.get('/tickets/:number/sla-history', require('../../../controllers/admin.controller').ticketSlaHistory);
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
router.post('/tickets/:number/sla/predict', moduleRequired('helpdesk'), requirePermission('tickets.view'), async (req, res, next) => {
  try {
    const { predictBreach } = require('../../../services/slaPredictor.service');
    const { loadTicketForAgent } = require('../../../controllers/helpdesk');
    const ticket = await loadTicketForAgent(req.params.number, req.agent);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const result = await predictBreach({ company: req.companyId, ticketId: ticket._id });
    res.json(result);
  } catch (e) { next(e); }
});
router.get('/queues/saved', ctrl.listSavedQueues);
router.post('/queues/saved', ctrl.createSavedQueue);
router.delete('/queues/saved/:id', ctrl.deleteSavedQueue);
router.post('/tickets/:number/tasks', moduleRequired('helpdesk'), requirePermission('tickets.tasks'), ctrl.addTask);
router.put('/tickets/:number/tasks/:taskId', moduleRequired('helpdesk'), requirePermission('tickets.tasks'), ctrl.updateTask);

// Assistant (tenant-learned triage + summarization, MD ITSM-02/15)
router.post('/tickets/suggest', moduleRequired('helpdesk'), assistCtrl.suggestTriage);
router.get('/tickets/suggest-refs', moduleRequired('helpdesk'), assistCtrl.suggestRefs);
router.post('/assist/summarize', moduleRequired('helpdesk'), assistCtrl.summarize);
router.use(incidentRoutes);
router.use(userRoutes);
router.use(knowledgeRoutes);

module.exports = router;
