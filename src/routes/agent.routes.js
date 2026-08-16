const express = require('express');
const { protectAgent } = require('../middleware/auth');
const { upload } = require('../config/multer');
const ctrl = require('../controllers/agent.controller');

const router = express.Router();

router.use(protectAgent);

// Dashboard & queues
router.get('/dashboard', ctrl.dashboard);
router.get('/queues', ctrl.queues);
router.get('/directory', ctrl.agentDirectory);
router.get('/directory/users', ctrl.directoryUsers);

// Notifications
router.get('/notifications', ctrl.notifications);
router.put('/notifications/read', ctrl.markNotificationsRead);
router.put('/notifications/:id/read', ctrl.markNotificationRead);

// Tickets
router.get('/tickets', ctrl.listTickets);
router.post('/tickets', ctrl.create);
router.get('/tickets/export', ctrl.exportTickets);
router.get('/tickets/:number', ctrl.getTicket);
router.post('/tickets/:number/reply', upload.array('files', 5), ctrl.reply);
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
router.get('/queues/saved', ctrl.listSavedQueues);
router.post('/queues/saved', ctrl.createSavedQueue);
router.delete('/queues/saved/:id', ctrl.deleteSavedQueue);
router.post('/tickets/:number/tasks', ctrl.addTask);
router.put('/tickets/:number/tasks/:taskId', ctrl.updateTask);

// Supervision
router.get('/workload', ctrl.workload);
router.get('/escalations', ctrl.listEscalations);
router.post('/escalations', ctrl.createEscalation);
router.put('/escalations/:id', ctrl.updateEscalation);
router.delete('/escalations/:id', ctrl.deleteEscalation);

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
router.get('/faq-categories', ctrl.listFaqCategories);
router.post('/faq-categories', ctrl.createFaqCategory);
router.get('/faqs', ctrl.listFaqs);
router.post('/faqs', ctrl.createFaq);
router.put('/faqs/:id', ctrl.updateFaq);
router.delete('/faqs/:id', ctrl.deleteFaq);

// Announcements
router.get('/announcements', ctrl.listAnnouncements);
router.post('/announcements', ctrl.createAnnouncement);
router.delete('/announcements/:id', ctrl.deleteAnnouncement);

module.exports = router;
