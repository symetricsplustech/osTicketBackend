const express = require('express');
const { protectAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');
const { upload } = require('../config/multer');

const router = express.Router();

router.use(protectAdmin);

// Dashboard
router.get('/dashboard', ctrl.dashboard);
router.get('/info', ctrl.systemInfo);
router.get('/logs', ctrl.emailLogs);

// Notifications
router.get('/notifications', ctrl.notifications);
router.put('/notifications/read', ctrl.markNotificationsRead);
router.put('/notifications/:id/read', ctrl.markNotificationRead);
router.delete('/notifications/read', ctrl.deleteReadNotifications);
router.delete('/notifications/:id', ctrl.deleteNotification);

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
router.post('/email-templates', ctrl.createEmailTemplate);
router.get('/email-templates/:id', ctrl.getEmailTemplate);
router.put('/email-templates/:id', ctrl.updateEmailTemplate);
router.delete('/email-templates/:id', ctrl.deleteEmailTemplate);

// Settings
router.get('/settings', ctrl.getSettings);
router.put('/settings', ctrl.updateSettings);
router.get('/company', ctrl.getCompanySettings);
router.put('/company', ctrl.updateCompanySettings);
router.post('/company/logo', upload.single('logo'), ctrl.uploadCompanyLogo);

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

// Ticket Statuses
router.get('/ticket-statuses', ctrl.ticketStatuses.list);
router.post('/ticket-statuses', ctrl.ticketStatuses.create);
router.put('/ticket-statuses/:id', ctrl.ticketStatuses.update);
router.delete('/ticket-statuses/:id', ctrl.ticketStatuses.remove);

// Custom Fields
router.get('/custom-fields', ctrl.customFields.list);
router.post('/custom-fields', ctrl.customFields.create);
router.put('/custom-fields/:id', ctrl.customFields.update);
router.delete('/custom-fields/:id', ctrl.customFields.remove);

// Ticket Forms
router.get('/ticket-forms', ctrl.ticketForms.list);
router.post('/ticket-forms', ctrl.ticketForms.create);
router.put('/ticket-forms/:id', ctrl.ticketForms.update);
router.delete('/ticket-forms/:id', ctrl.ticketForms.remove);

// Holidays
router.get('/holidays', ctrl.holidays.list);
router.post('/holidays', ctrl.holidays.create);
router.put('/holidays/:id', ctrl.holidays.update);
router.delete('/holidays/:id', ctrl.holidays.remove);

// Integrations / Plugins
router.get('/integrations', ctrl.integrations.list);
router.post('/integrations', ctrl.integrations.create);
router.put('/integrations/:id', ctrl.integrations.update);
router.delete('/integrations/:id', ctrl.integrations.remove);

module.exports = router;
