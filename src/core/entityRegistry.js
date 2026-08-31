// Entity Registry — single source of truth for every entity in the platform.
// Each entry defines: model, display fields, ref fields (populated from other entities),
// relationships (for related lists), and automations (post-create/post-update cascades).

const mongoose = require('mongoose');

// Lazy model loader — resolves at call time, not import time
function M(name) {
  try { return mongoose.model(name); }
  catch (_) {
    // Try loading from known paths
    const paths = [
      `../models/${name}`,
      `../models/Platform2`, `../models/Platform3`, `../models/Platform4`,
      `../models/Platform5`, `../models/Platform6`, `../models/Platform7`,
      `../models/Product`, `../models/License`, `../models/Stockroom`,
      `../models/CustomerService`, `../models/WorkflowExecutionLog`,
      `../models/ScheduledReport`, `../models/Remaining`, `../models/Enterprise`,
    ];
    for (const p of paths) {
      try {
        const mod = require(p);
        if (typeof mod === 'function') return mod;
        if (mod[name]) return mod[name];
      } catch (_) {}
    }
    throw new Error(`Model "${name}" not found`);
  }
}

// ---- Automation hooks: fire after create/update, cascade across modules ----
const AUTOMATIONS = {
  Ticket: {
    async afterCreate(doc, req) {
      const TicketM = M('Ticket');
      // Auto-assign via least-loaded router
      try {
        const Agent = M('Agent');
        const agents = await Agent.find({ tenantId: doc.tenantId }).limit(50);
        if (!agents.length) return;
        const loads = {};
        for (const a of agents) loads[String(a._id)] = await TicketM.countDocuments({ assignedTo: a._id, status: { $nin: ['closed'] } });
        const best = [...agents].sort((a, b) => (loads[String(a._id)] || 0) - (loads[String(b._id)] || 0))[0];
        await TicketM.updateOne({ _id: doc._id }, { assignedTo: best._id, status: 'assigned' });
      } catch (_) {}
      // Create SLA instance
      try {
        const SlaPlan = M('SlaPlan');
        const plans = await SlaPlan.find({ tenantId: doc.tenantId }).sort({ createdAt: -1 }).limit(1);
        if (plans.length && !doc.sla) {
          await TicketM.updateOne({ _id: doc._id }, { sla: plans[0]._id });
        }
      } catch (_) {}
    },
    async afterUpdate(doc, prev, req) {
      // Status change → resolved → create CSAT survey
      if (prev.status !== 'resolved' && doc.status === 'resolved') {
        try {
          const Survey = M('Survey');
          await Survey.create({ ticket: doc._id, type: 'csat', status: 'pending', tenantId: doc.tenantId || req.user?.tenantId });
        } catch (_) {}
      }
      // Escalate on priority bump
      if (prev.priority !== doc.priority && ['high', 'critical'].includes(doc.priority)) {
        try {
          const Notification = M('Notification');
          await Notification.create({ user: doc.assignedTo, title: `Ticket escalated to ${doc.priority}`, message: `${doc.number}: ${doc.title}`, read: false }).catch(() => {});
        } catch (_) {}
      }
    },
  },
  Incident: {
    async afterCreate(doc, req) {
      // Link CI if provided
      if (req.body.ciId) {
        try { await mongoose.connection.db.collection('incidentcimetas').updateOne(
          { incident: doc._id }, { $set: { cis: [mongoose.Types.ObjectId(req.body.ciId)] } }, { upsert: true }); } catch (_) {}
      }
      // Notify on-call
      try {
        const Notification = M('Notification');
        const OnCallSchedule = mongoose.models.OnCallSchedule;
        if (OnCallSchedule) {
          const schedules = await OnCallSchedule.find({ tenantId: doc.tenantId, status: 'active' }).populate('rotations.agent').limit(1);
          if (schedules.length) {
            const onCall = schedules[0].rotations?.[0]?.agent;
            if (onCall?._id) await Notification.create({ user: onCall._id, title: `[INCIDENT] ${doc.title}`, message: `Severity ${doc.severity}`, read: false });
          }
        }
      } catch (_) {}
    },
  },
  Opportunity: {
    async afterUpdate(doc, prev, req) {
      // Won opportunity cascade
      if (prev.stage !== 'closed_won' && doc.stage === 'closed_won') {
        try {
          const Contract = M('Contract');
          await Contract.create({ name: `Contract from ${doc.name}`, value: doc.value || 0, startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000), company: doc.company, tenantId: doc.tenantId });
        } catch (_) {}
        try {
          const Entitlement = M('Entitlement');
          await Entitlement.create({ name: `Support — ${doc.name}`, tenantId: doc.tenantId }).catch(() => {});
        } catch (_) {}
      }
    },
  },
};

// ---- Entity definitions ----
const ENTITIES = {
  ticket: { model: 'Ticket', label: 'Ticket', numberField: 'number', titleField: 'title',
    fields: ['number', 'title', 'status', 'priority', 'source', 'category', 'createdAt'],
    refs: { requester: 'User', assignedTo: 'Agent', sla: 'SlaPlan', department: 'Department' },
    related: [{ entity: 'ticket_thread', fk: 'ticket' }, { entity: 'task', fk: 'ticket' }],
    editable: ['title', 'status', 'priority', 'category', 'description', 'assignedTo'] },

  incident: { model: 'Incident', label: 'Incident', numberField: '_id', titleField: 'title',
    fields: ['title', 'severity', 'status', 'commander', 'isMajor', 'createdAt'],
    refs: { commander: 'Agent' }, editable: ['title', 'severity', 'status', 'description'],
    automations: 'Incident' },

  problem: { model: 'Problem', label: 'Problem', titleField: 'title',
    fields: ['title', 'status', 'knownError', 'rootCause'], refs: {},
    editable: ['title', 'status', 'rootCause', 'workaround', 'knownError'] },

  change: { model: 'Change', label: 'Change', titleField: 'title',
    fields: ['title', 'type', 'riskLevel', 'status', 'windowStart', 'windowEnd'],
    editable: ['title', 'type', 'riskLevel', 'status', 'implementationPlan', 'rollbackPlan', 'windowStart', 'windowEnd'] },

  lead: { model: 'Lead', label: 'Lead', titleField: 'name',
    fields: ['name', 'email', 'phone', 'company', 'source', 'status', 'score'],
    refs: {}, editable: ['name', 'email', 'phone', 'company', 'source', 'status', 'score'] },

  opportunity: { model: 'Opportunity', label: 'Opportunity', titleField: 'name',
    fields: ['name', 'stage', 'value', 'probability', 'closeDate'],
    editable: ['name', 'stage', 'value', 'probability', 'closeDate'], automations: 'Opportunity' },

  quote: { model: 'Quote', label: 'Quote', numberField: 'number', titleField: 'accountName',
    fields: ['number', 'accountName', 'total', 'status', 'validUntil'],
    editable: ['accountName', 'status', 'notes', 'validUntil'] },

  contract: { model: 'Contract', label: 'Contract', titleField: 'name',
    fields: ['name', 'value', 'startDate', 'endDate'], editable: ['name', 'value', 'startDate', 'endDate'] },

  asset: { model: 'Asset', label: 'Asset', titleField: 'name',
    fields: ['name', 'type', 'serialNumber', 'status', 'location'], editable: ['name', 'type', 'status', 'location', 'serialNumber'] },

  ci: { model: 'CI', label: 'Configuration Item', titleField: 'name',
    fields: ['name', 'ciClass', 'environment', 'criticality', 'ipAddress', 'status'],
    editable: ['name', 'ciClass', 'environment', 'criticality', 'ipAddress', 'owner', 'attributes'] },

  resource: { model: 'Resource', label: 'Infrastructure Resource', titleField: 'name',
    fields: ['name', 'type', 'status', 'ipAddress'], editable: ['name', 'type', 'status', 'metadata'] },

  alert: { model: 'Alert', label: 'Alert', titleField: 'title',
    fields: ['title', 'severity', 'status', 'createdAt'], editable: ['title', 'severity', 'status'] },

  project: { model: 'Project', label: 'Project', titleField: 'name',
    fields: ['name', 'status', 'progress', 'budget', 'spent'], editable: ['name', 'status', 'budget', 'spent', 'manager', 'team'] },

  hr_case: { model: 'HrCase', label: 'HR Case', numberField: 'number', titleField: 'title',
    fields: ['number', 'title', 'category', 'confidential', 'status'], editable: ['title', 'category', 'status', 'confidential'] },

  work_order: { model: 'WorkOrder', label: 'Work Order', numberField: 'number', titleField: 'title',
    fields: ['number', 'title', 'status', 'scheduledDate', 'technician'], editable: ['title', 'status', 'scheduledDate', 'location'] },

  kb_article: { model: 'Faq', label: 'Knowledge Article', titleField: 'question',
    fields: ['question', 'published', 'helpful', 'notHelpful'], editable: ['question', 'answer', 'published'] },

  user: { model: 'User', label: 'User', titleField: 'name',
    fields: ['name', 'email', 'role', 'status'], editable: ['name', 'email', 'role', 'status', 'phone'] },

  agent: { model: 'Agent', label: 'Agent', titleField: 'name',
    fields: ['name', 'email', 'isActive'], editable: ['name', 'email', 'isActive'] },

  company: { model: 'Company', label: 'Organization', titleField: 'name',
    fields: ['name', 'status', 'industry'], editable: ['name', 'status', 'industry', 'address'] },

  task: { model: 'Task', label: 'Task', titleField: 'title',
    fields: ['title', 'status', 'priority', 'dueDate'], editable: ['title', 'status', 'priority', 'dueDate', 'assignee', 'checklist'] },

  approval: { model: 'Approval', label: 'Approval', titleField: 'entityType',
    fields: ['entityType', 'entityId', 'status', 'approverRole'], editable: ['status'] },

  campaign: { model: 'Campaign', label: 'Campaign', titleField: 'name',
    fields: ['name', 'channel', 'status', 'members'], editable: ['name', 'channel', 'status', 'budget'] },

  security_incident: { model: 'SecurityIncident', label: 'Security Incident', numberField: 'number', titleField: 'title',
    fields: ['number', 'title', 'category', 'severity', 'status', 'riskScore'], editable: ['title', 'severity', 'status', 'mitreTactics'] },

  vulnerability: { model: 'Vulnerability', label: 'Vulnerability', titleField: 'title',
    fields: ['title', 'cveId', 'severity', 'riskScore', 'status'], editable: ['title', 'severity', 'status', 'remediationTask'] },

  risk_item: { model: 'RiskItem', label: 'Risk', titleField: 'statement',
    fields: ['statement', 'category', 'likelihood', 'impact', 'inherentScore', 'residualScore'], editable: ['statement', 'likelihood', 'impact', 'treatment', 'treatmentPlan'] },

  control_item: { model: 'Control', label: 'Control', titleField: 'name',
    fields: ['name', 'controlType', 'frequency', 'effectiveness'], editable: ['name', 'controlObjective', 'frequency', 'owner'] },

  policy_document: { model: 'PolicyDocument', label: 'Policy', titleField: 'title',
    fields: ['title', 'version', 'status'], editable: ['title', 'content', 'status', 'nextReviewDate'] },

  building: { model: 'Building', label: 'Building', titleField: 'name',
    fields: ['name', 'address', 'capacity'], editable: ['name', 'address', 'capacity', 'amenities'] },

  space: { model: 'Space', label: 'Space', titleField: 'name',
    fields: ['name', 'spaceType', 'capacity', 'accessibility'], editable: ['name', 'spaceType', 'capacity'] },

  reservation: { model: 'Reservation', label: 'Reservation', titleField: '_id',
    fields: ['space', 'reservedBy', 'date', 'startSlot', 'status'], editable: ['date', 'startSlot', 'endSlot', 'status'] },

  legal_matter: { model: 'LegalMatter', label: 'Legal Matter', titleField: 'title',
    fields: ['title', 'practiceArea', 'status', 'budget'], editable: ['title', 'status', 'budget', 'privilege'] },

  supplier: { model: 'Supplier', label: 'Supplier', titleField: 'name',
    fields: ['name', 'onboardingStatus', 'performanceRating'], editable: ['name', 'taxId', 'onboardingStatus'] },

  requisition: { model: 'Requisition', label: 'Requisition', numberField: 'number', titleField: 'businessNeed',
    fields: ['number', 'businessNeed', 'totalEstimate', 'status'], editable: ['businessNeed', 'neededBy', 'status'] },

  finance_case: { model: 'FinanceCase', label: 'Finance Case', numberField: 'number', titleField: 'title',
    fields: ['number', 'title', 'caseType', 'amount', 'status'], editable: ['title', 'amount', 'reasonCode', 'status'] },

  esg_metric: { model: 'EsgMetric', label: 'ESG Metric', titleField: 'name',
    fields: ['name', 'framework', 'pillar', 'scope', 'unit'], editable: ['name', 'framework', 'pillar', 'scope', 'targetValue'] },

  workflow_def: { model: 'Workflow', label: 'Workflow', titleField: 'name',
    fields: ['name', 'event', 'status', 'runCount'], editable: ['name', 'description', 'conditions', 'actions'] },

  saved_report: { model: 'CustomReport', label: 'Saved Report', titleField: 'name',
    fields: ['name', 'module', 'type', 'chartType'], editable: ['name', 'filters', 'groupBy', 'chartType'] },
};

function resolve(entityKey) {
  const def = ENTITIES[entityKey];
  if (!def) return null;
  let Model;
  try { Model = M(def.model); } catch (_) { return null; }
  return { ...def, Model, key: entityKey };
}

module.exports = { ENTITIES, resolve, M, AUTOMATIONS };
