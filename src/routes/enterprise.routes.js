const express = require('express');
const { protectAgent, protectAdmin, protectUser, optionalUser } = require('../middleware/auth');
const { protectApiKey, hasScope } = require('../middleware/apikey');
const ctrl = require('../controllers/enterprise.controller');

const router = express.Router();

// ---------- Developer platform: authenticated API (API keys) ----------
router.get('/dev/tickets', protectApiKey, async (req, res, next) => {
  if (!hasScope(req, 'tickets:read')) return next(new (require('../utils/ApiError'))(403, 'Missing scope: tickets:read'));
  const Ticket = require('../models/Ticket');
  const { getPagination, getSortObj } = require('../utils/pagination');
  const { page, limit, skip, sort } = getPagination(req, { sort: '-createdAt' });
  const query = req.companyId ? { company: req.companyId } : {};
  const [items, total] = await Promise.all([
    Ticket.find(query).select('number subject status priority source sla dueDate createdAt').sort(getSortObj(sort)).skip(skip).limit(limit),
    Ticket.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit });
});

router.get('/dev/webhooks/events', protectApiKey, async (req, res) => {
  const { EVENT_NAMES } = require('../services/events');
  res.json({ success: true, events: EVENT_NAMES });
});

// ---------- Skills (admin) ----------
router.get('/skills', protectAgent, ctrl.listSkills);
router.post('/skills', protectAdmin, ctrl.createSkill);
router.put('/skills/:id', protectAdmin, ctrl.updateSkill);
router.delete('/skills/:id', protectAdmin, ctrl.deleteSkill);

// ---------- Workflows / no-code automation (admin) ----------
router.get('/workflows', protectAgent, ctrl.listWorkflows);
router.post('/workflows', protectAdmin, ctrl.createWorkflow);
router.put('/workflows/:id', protectAdmin, ctrl.updateWorkflow);
router.delete('/workflows/:id', protectAdmin, ctrl.deleteWorkflow);
router.post('/workflows/:id/test', protectAdmin, ctrl.testWorkflow);

// ---------- Approvals ----------
router.get('/approvals', protectAgent, ctrl.listApprovals);
router.get('/approvals/mine', protectAgent, ctrl.getApprovalsForMe);
router.get('/approvals/:id', protectAgent, ctrl.getApproval);
router.post('/approvals', protectAgent, ctrl.createApproval);
router.post('/approvals/:id/decide', protectAgent, ctrl.decideApproval);
router.post('/approvals/:id/delegate', protectAgent, ctrl.delegateApproval);

// ---------- Incidents ----------
router.get('/incidents', protectAgent, ctrl.listIncidents);
router.get('/incidents/:id', protectAgent, ctrl.getIncident);
router.post('/incidents', protectAgent, ctrl.createIncident);
router.put('/incidents/:id', protectAgent, ctrl.updateIncident);
router.post('/incidents/:id/timeline', protectAgent, ctrl.addIncidentTimeline);
router.post('/incidents/:id/link-tickets', protectAgent, ctrl.linkTicketsToIncident);

// ---------- Problems ----------
router.get('/problems', protectAgent, ctrl.listProblems);
router.get('/problems/:id', protectAgent, ctrl.getProblem);
router.post('/problems', protectAgent, ctrl.createProblem);
router.put('/problems/:id', protectAgent, ctrl.updateProblem);
router.delete('/problems/:id', protectAgent, ctrl.deleteProblem);

// ---------- Changes ----------
router.get('/changes', protectAgent, ctrl.listChanges);
router.get('/changes/:id', protectAgent, ctrl.getChange);
router.post('/changes', protectAgent, ctrl.createChange);
router.put('/changes/:id', protectAgent, ctrl.updateChange);
router.post('/changes/:id/request-approval', protectAgent, ctrl.submitChangeForApproval);

// ---------- Assets / CMDB / dependencies ----------
router.get('/assets', protectAgent, ctrl.listAssets);
router.get('/assets/:id', protectAgent, ctrl.getAsset);
router.post('/assets', protectAgent, ctrl.createAsset);
router.put('/assets/:id', protectAgent, ctrl.updateAsset);
router.delete('/assets/:id', protectAgent, ctrl.deleteAsset);
router.get('/assets/:id/impact', protectAgent, ctrl.dependencyImpact);
router.get('/dependencies', protectAgent, ctrl.listDependencies);
router.post('/dependencies', protectAgent, ctrl.createDependency);
router.delete('/dependencies/:id', protectAgent, ctrl.deleteDependency);

// ---------- Service catalog ----------
router.get('/catalog', protectAgent, ctrl.listCatalogItems);
router.post('/catalog', protectAdmin, ctrl.createCatalogItem);
router.put('/catalog/:id', protectAdmin, ctrl.updateCatalogItem);
router.delete('/catalog/:id', protectAdmin, ctrl.deleteCatalogItem);

// ---------- Contracts & entitlements ----------
router.get('/contracts', protectAgent, ctrl.listContracts);
router.get('/contracts/:id', protectAgent, ctrl.getContract);
router.post('/contracts', protectAdmin, ctrl.createContract);
router.put('/contracts/:id', protectAdmin, ctrl.updateContract);
router.delete('/contracts/:id', protectAdmin, ctrl.deleteContract);
router.get('/entitlements', protectAgent, ctrl.listEntitlements);
router.post('/entitlements', protectAdmin, ctrl.createEntitlement);
router.put('/entitlements/:id', protectAdmin, ctrl.updateEntitlement);
router.delete('/entitlements/:id', protectAdmin, ctrl.deleteEntitlement);

// ---------- Surveys / CSAT / NPS / CES ----------
router.get('/surveys', protectAgent, ctrl.listSurveys);
router.get('/surveys/results', protectAgent, ctrl.surveyResults);
router.post('/surveys', protectAdmin, ctrl.createSurvey);
router.put('/surveys/:id', protectAdmin, ctrl.updateSurvey);
router.delete('/surveys/:id', protectAdmin, ctrl.deleteSurvey);

// ---------- Status pages & incidents ----------
router.get('/status-pages', protectAgent, ctrl.listStatusPages);
router.post('/status-pages', protectAdmin, ctrl.createStatusPage);
router.put('/status-pages/:id', protectAdmin, ctrl.updateStatusPage);
router.delete('/status-pages/:id', protectAdmin, ctrl.deleteStatusPage);
router.post('/status-pages/:id/components', protectAdmin, ctrl.addStatusComponent);
router.delete('/status-pages/:id/components/:componentId', protectAdmin, ctrl.removeStatusComponent);
router.put('/status-pages/:id/components/:componentId', protectAdmin, ctrl.updateStatusComponent);
router.get('/status-incidents', protectAgent, ctrl.listStatusIncidents);
router.post('/status-incidents', protectAdmin, ctrl.createStatusIncident);
router.put('/status-incidents/:id', protectAdmin, ctrl.updateStatusIncident);
router.get('/outage-signals', protectAgent, ctrl.detectOutageSignals);
router.post('/outage-signals/promote', protectAdmin, ctrl.promoteSignalsToIncident);

// ---------- Developer platform: webhooks + API keys ----------
router.get('/webhooks', protectAdmin, ctrl.listWebhooks);
router.post('/webhooks', protectAdmin, ctrl.createWebhook);
router.put('/webhooks/:id', protectAdmin, ctrl.updateWebhook);
router.delete('/webhooks/:id', protectAdmin, ctrl.deleteWebhook);
router.get('/api-keys', protectAdmin, ctrl.listApiKeys);
router.post('/api-keys', protectAdmin, ctrl.createApiKey);
router.delete('/api-keys/:id', protectAdmin, ctrl.deleteApiKey);

// ---------- Ticket relationships ----------
router.get('/tickets/:number/links', protectAgent, ctrl.listTicketLinks);
router.post('/tickets/:number/links', protectAgent, ctrl.addTicketLink);
router.delete('/tickets/:number/links/:linkId', protectAgent, ctrl.removeTicketLink);

// ---------- Voice / call logs ----------
router.get('/calls', protectAgent, ctrl.listCallLogs);
router.post('/calls', protectAgent, ctrl.createCallLog);
router.put('/calls/:id', protectAgent, ctrl.updateCallLog);

// ---------- Omnichannel chat inbox (agent) ----------
router.get('/conversations', protectAgent, ctrl.listConversations);
router.get('/conversations/:id', protectAgent, ctrl.getConversation);
router.post('/conversations/:id/messages', protectAgent, ctrl.agentPostMessage);
router.post('/conversations/:id/assign', protectAgent, ctrl.assignConversation);
router.post('/conversations/:id/close', protectAgent, ctrl.closeConversation);

// ---------- Customer 360 ----------
router.get('/customer360/:id', protectAgent, ctrl.customer360);
router.get('/customer360/org/:orgId', protectAgent, ctrl.customer360);

// ---------- CSAT submit (user) ----------
router.post('/csat/submit', optionalUser, ctrl.submitCsat);

// ---------- Advanced search / audit / realtime / reports ----------
router.get('/search', protectAgent, ctrl.globalSearch);
router.get('/audit', protectAgent, ctrl.auditLogs);
router.get('/realtime', protectAgent, ctrl.realTimeDashboard);
router.get('/reports/agents', protectAgent, ctrl.agentMetricsReport);
router.get('/reports/departments', protectAgent, ctrl.departmentMetricsReport);
router.get('/reports/customers', protectAgent, ctrl.customerMetricsReport);
router.get('/reports/volume', protectAgent, ctrl.volumeTrendReport);
router.get('/reports/overview', protectAgent, ctrl.reportOverview);

module.exports = router;