const express = require('express');
const { protectAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');

const router = express.Router();

router.use(protectAdmin);

// Dashboard
router.get('/dashboard', ctrl.dashboard);
router.get('/info', ctrl.systemInfo);
router.get('/logs', ctrl.emailLogs);

// Notifications
router.get('/notifications', ctrl.notifications);
router.put('/notifications/read', ctrl.markNotificationsRead);

// Agents
router.get('/agents', ctrl.listAgents);
router.post('/agents', ctrl.createAgent);
router.put('/agents/:id', ctrl.updateAgent);
router.delete('/agents/:id', ctrl.deleteAgent);

// Roles
router.get('/roles', ctrl.getRoles);
router.post('/roles', ctrl.createRole);
router.put('/roles/:id', ctrl.updateRole);
router.delete('/roles/:id', ctrl.deleteRole);

// Teams
router.get('/teams', ctrl.listTeams);
router.post('/teams', ctrl.createTeam);
router.put('/teams/:id', ctrl.updateTeam);
router.delete('/teams/:id', ctrl.deleteTeam);

// Departments
router.get('/departments', ctrl.listDepartments);
router.post('/departments', ctrl.createDepartment);
router.put('/departments/:id', ctrl.updateDepartment);
router.delete('/departments/:id', ctrl.deleteDepartment);

// Help Topics
router.get('/help-topics', ctrl.listHelpTopics);
router.post('/help-topics', ctrl.createHelpTopic);
router.put('/help-topics/:id', ctrl.updateHelpTopic);
router.delete('/help-topics/:id', ctrl.deleteHelpTopic);

// SLA Plans
router.get('/sla-plans', ctrl.listSlaPlans);
router.post('/sla-plans', ctrl.createSlaPlan);
router.put('/sla-plans/:id', ctrl.updateSlaPlan);
router.delete('/sla-plans/:id', ctrl.deleteSlaPlan);

// Ticket Filters
router.get('/filters', ctrl.listFilters);
router.post('/filters', ctrl.createFilter);
router.put('/filters/:id', ctrl.updateFilter);
router.delete('/filters/:id', ctrl.deleteFilter);

// Email Templates
router.get('/email-templates', ctrl.listEmailTemplates);
router.get('/email-templates/:id', ctrl.getEmailTemplate);
router.put('/email-templates/:id', ctrl.updateEmailTemplate);

// Settings
router.get('/settings', ctrl.getSettings);
router.put('/settings', ctrl.updateSettings);

// Users
router.get('/users', ctrl.listUsers);
router.post('/users', ctrl.createUser);
router.put('/users/:id', ctrl.updateUser);
router.delete('/users/:id', ctrl.deleteUser);

// Organizations
router.get('/orgs', ctrl.listOrgs);
router.post('/orgs', ctrl.createOrg);
router.put('/orgs/:id', ctrl.updateOrg);
router.delete('/orgs/:id', ctrl.deleteOrg);

// Canned responses
router.get('/canned', ctrl.listCanned);
router.put('/canned/:id', ctrl.updateCanned);
router.delete('/canned/:id', ctrl.deleteCanned);

// FAQ
router.put('/faq-categories/:id', ctrl.updateFaqCategory);
router.delete('/faq-categories/:id', ctrl.deleteFaqCategory);
router.post('/faqs', ctrl.createFaq);
router.put('/faqs/:id', ctrl.updateFaq);
router.delete('/faqs/:id', ctrl.deleteFaq);

// Announcements
router.post('/announcements', ctrl.createAnnouncement);
router.put('/announcements/:id', ctrl.updateAnnouncement);
router.delete('/announcements/:id', ctrl.deleteAnnouncement);

// Utilities
router.post('/recompute-due-dates', ctrl.recomputeDueDates);

module.exports = router;
