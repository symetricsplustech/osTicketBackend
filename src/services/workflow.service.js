const Workflow = require('../models/Workflow');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Agent = require('../models/Agent');
const Team = require('../models/Team');
const Department = require('../models/Department');
const HelpTopic = require('../models/HelpTopic');
const { bus, emit } = require('./events');
const { notifyAgent, notifyUser, notifyAdminRoom } = require('./notification.service');
const { sendFromTemplate } = require('./email.service');
const approvalService = require('./approval.service');
const slaService = require('./sla.service');

let initialized = false;

// ---------------------------------------------------------------------------
// Context assembly
// ---------------------------------------------------------------------------
async function loadContext(payload) {
  const ctx = {
    event: payload.event || payload.type,
    company: payload.company || null,
    actor: payload.actor || null,
    ticketId: payload.ticketId || payload.ticket?._id || null,
    ticket: null,
    user: null,
    organization: null,
    custom: payload.custom || {},
  };
  if (ctx.ticketId) {
    ctx.ticket = await Ticket.findById(ctx.ticketId)
      .populate('dept')
      .populate('topic')
      .populate('user', 'tier organization')
      .populate('agent', 'name')
      .populate('team', 'name');
    if (ctx.ticket?.user) {
      ctx.user = await User.findById(ctx.ticket.user).lean();
      if (ctx.user?.organization) ctx.organization = await Organization.findById(ctx.user.organization).lean();
    }
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------
const getFieldValue = async (field, ctx) => {
  const t = ctx.ticket;
  switch (field) {
    case 'priority':
      return t?.priority;
    case 'status':
      return t?.status;
    case 'dept':
      return t?.dept?._id ? String(t.dept._id) : null;
    case 'topic':
      return t?.topic?._id ? String(t.topic._id) : null;
    case 'source':
      return t?.source;
    case 'customer_tier':
      return ctx.user?.tier || ctx.organization?.tier || 'standard';
    case 'organization':
      return ctx.user?.organization ? String(ctx.user.organization) : null;
    case 'entitlement':
      return t?.entitlementStatus;
    case 'sentiment':
      return t?.sentiment;
    case 'language':
      return t?.language;
    case 'subject':
      return t?.subject || '';
    case 'waiting_on':
      return t?.waitingOn || 'none';
    case 'is_overdue':
      return !!t?.isOverdue;
    case 'custom_data':
      return t?.customData || {};
    default:
      return null;
  }
};

const matchesOperator = (value, operator, expected) => {
  switch (operator) {
    case 'equals':
      return value === expected || String(value) === String(expected);
    case 'not_equals':
      return !(value === expected || String(value) === String(expected));
    case 'contains':
      return String(value || '').toLowerCase().includes(String(expected || '').toLowerCase());
    case 'in':
      return Array.isArray(expected) && expected.map(String).includes(String(value));
    case 'not_in':
      return !(Array.isArray(expected) && expected.map(String).includes(String(value)));
    case 'exists':
      return value !== null && value !== undefined && value !== '';
    case 'greater_than':
      return Number(value) > Number(expected);
    case 'less_than':
      return Number(value) < Number(expected);
    default:
      return true;
  }
};

const evalConditions = async (workflow, ctx) => {
  for (const cond of workflow.conditions || []) {
    const value = await getFieldValue(cond.field, ctx);
    if (!matchesOperator(value, cond.operator, cond.value)) return false;
  }
  // trigger-level filters (dept/priority/topic/status/source arrays)
  const f = workflow.triggerFilters || {};
  if (f.dept && ctx.ticket?.dept && !f.dept.map(String).includes(String(ctx.ticket.dept._id))) return false;
  if (f.priority && ctx.ticket?.priority && !f.priority.includes(ctx.ticket.priority)) return false;
  if (f.topic && ctx.ticket?.topic && !f.topic.map(String).includes(String(ctx.ticket.topic._id))) return false;
  if (f.status && ctx.ticket?.status && !f.status.includes(ctx.ticket.status)) return false;
  if (f.source && ctx.ticket?.source && !f.source.includes(ctx.ticket.source)) return false;
  return true;
};

// ---------------------------------------------------------------------------
// Action execution
// ---------------------------------------------------------------------------
const executeAction = async (action, ctx) => {
  const t = ctx.ticket;
  const cfg = action.config || {};
  switch (action.type) {
    case 'assign_agent':
      if (t && cfg.agentId) {
        await Ticket.updateOne({ _id: t._id }, { $set: { agent: cfg.agentId, status: Ticket.STATUSES.ASSIGNED } });
        await notifyAgent({ agentId: cfg.agentId, type: 'assignment', message: `Ticket #${t.number} assigned by automation`, link: `/agent/tickets/${t.number}`, ticket: t._id, company: ctx.company });
        emit('ticket.assigned', { company: ctx.company, ticketId: t._id, ticketNumber: t.number });
      }
      break;
    case 'assign_team':
      if (t && cfg.teamId) {
        const team = await Team.findById(cfg.teamId).lean();
        await Ticket.updateOne({ _id: t._id }, { $set: { team: cfg.teamId, status: Ticket.STATUSES.ASSIGNED } });
        if (team?.members?.length) {
          for (const m of team.members.slice(0, 5)) {
            await notifyAgent({ agentId: m, type: 'assignment', message: `Ticket #${t.number} assigned to team ${team.name}`, link: `/agent/tickets/${t.number}`, ticket: t._id, company: ctx.company });
          }
        }
      }
      break;
    case 'transfer_dept':
      if (t && cfg.deptId) {
        await Ticket.updateOne({ _id: t._id }, { $set: { dept: cfg.deptId } });
        emit('ticket.transferred', { company: ctx.company, ticketId: t._id, ticketNumber: t.number });
      }
      break;
    case 'set_priority':
      if (t && cfg.priority) {
        await Ticket.updateOne({ _id: t._id }, { $set: { priority: cfg.priority } });
        emit('ticket.priority_changed', { company: ctx.company, ticketId: t._id, ticketNumber: t.number, priority: cfg.priority });
      }
      break;
    case 'set_sla':
      if (t && cfg.slaId) {
        const due = await slaService.computeDueDate(cfg.slaId, new Date(), { slaType: t.slaType });
        await Ticket.updateOne({ _id: t._id }, { $set: { sla: cfg.slaId, dueDate: due, slaStartedAt: new Date(), isOverdue: false } });
      }
      break;
    case 'set_status':
      if (t && cfg.status && Ticket.STATUSES[String(cfg.status).toUpperCase()]) {
        await Ticket.updateOne({ _id: t._id }, { $set: { status: String(cfg.status).toLowerCase() } });
      }
      break;
    case 'add_tags':
      if (t && Array.isArray(cfg.tags)) {
        await Ticket.updateOne({ _id: t._id }, { $addToSet: { tags: { $each: cfg.tags } } });
      }
      break;
    case 'add_note':
      if (t && cfg.note) {
        const TicketThread = require('../models/TicketThread');
        await TicketThread.create({ ticket: t._id, company: ctx.company, type: 'note', posterType: 'system', title: 'Automation note', body: cfg.note });
      }
      break;
    case 'create_task':
      if (t) {
        const Task = require('../models/Task');
        await Task.create({ ticket: t._id, company: ctx.company, title: cfg.title || 'Task', description: cfg.description || '', assignedTo: cfg.assigneeId || null, dueDate: cfg.dueDate || null });
      }
      break;
    case 'notify_agent':
      if (cfg.agentId) {
        await notifyAgent({ agentId: cfg.agentId, type: 'system', message: cfg.message || `Workflow: ${cfg.note || 'attention needed'}`, link: t ? `/agent/tickets/${t.number}` : '', ticket: t?._id, company: ctx.company });
      }
      break;
    case 'notify_team':
      if (cfg.teamId) {
        const team = await Team.findById(cfg.teamId).lean();
        if (team?.members) {
          for (const m of team.members.slice(0, 8)) {
            await notifyAgent({ agentId: m, type: 'system', message: cfg.message || 'Team workflow notification', link: t ? `/agent/tickets/${t.number}` : '', ticket: t?._id, company: ctx.company });
          }
        }
      }
      break;
    case 'notify_dept_manager':
      if (t?.dept?.manager) {
        await notifyAgent({ agentId: t.dept.manager, type: 'escalation', message: cfg.message || `Department manager notified for #${t.number}`, link: `/agent/tickets/${t.number}`, ticket: t._id, company: ctx.company });
      } else {
        await notifyAdminRoom({ type: 'escalation', message: cfg.message || 'Workflow notification', link: t ? `/agent/tickets/${t.number}` : '', ticket: t?._id, company: ctx.company });
      }
      break;
    case 'notify_customer':
      if (t?.user) {
        await notifyUser({ userId: t.user, type: 'status_change', message: cfg.message || 'Update on your ticket', link: `/ticket/${t.number}`, ticket: t._id, company: ctx.company });
      }
      break;
    case 'send_email':
      if (cfg.templateKey) {
        await sendFromTemplate({ key: cfg.templateKey, data: ctx, event: 'workflow', ticket: t?._id, company: ctx.company }).catch(() => {});
      }
      break;
    case 'send_webhook':
      if (cfg.url) {
        try {
          await fetch(cfg.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-OsTicket-Automation': 'true' },
            body: JSON.stringify({ event: 'workflow.action', workflow: ctx.workflowName, ticketId: t?._id, ticketNumber: t?.number, payload: cfg.payload || {} }),
            signal: AbortSignal.timeout(10000),
          });
        } catch (err) {
          // ignore
        }
      }
      break;
    case 'start_approval': {
      const steps = (cfg.steps || []).map((s) => ({ assigneeType: s.assigneeType || 'agent', assignee: s.assigneeId || null, mode: s.mode || 'approve' }));
      if (steps.length) {
        await approvalService
          .createApproval({
            company: ctx.company,
            title: cfg.title || `Approval for ticket ${t ? `#${t.number}` : ''}`,
            description: cfg.description || '',
            refType: 'ticket',
            refId: t?._id,
            steps,
            mode: cfg.mode || 'sequential',
            timeoutHours: cfg.timeoutHours || 24,
            autoApproveAfterHours: cfg.autoApproveAfterHours || 0,
          })
          .catch(() => {});
      }
      break;
    }
    case 'pause_sla':
      if (t) await slaService.pauseSla(t);
      break;
    case 'resume_sla':
      if (t) await slaService.resumeSla(t);
      break;
    case 'escalate':
      if (t) {
        await Ticket.updateOne({ _id: t._id }, { $set: { priority: 'High', isOverdue: false, status: Ticket.STATUSES.OVERDUE } });
        await notifyAdminRoom({ type: 'escalation', message: `Ticket #${t.number} escalated by automation`, link: `/agent/tickets/${t.number}`, ticket: t._id, company: ctx.company });
        emit('ticket.escalated', { company: ctx.company, ticketId: t._id, ticketNumber: t.number });
      }
      break;
    case 'create_incident': {
      if (t) {
        const Incident = require('../models/Incident');
        const count = await Incident.countDocuments({ company: ctx.company });
        const incident = await Incident.create({
          number: `INC-${String(new Date().getFullYear())}-${String(count + 1).padStart(4, '0')}`,
          company: ctx.company,
          title: cfg.title || `Incident for ${t.number}`,
          summary: cfg.summary || '',
          severity: cfg.severity || 'Sev3',
          status: 'investigating',
          commander: cfg.commanderId || null,
          affectedTickets: [t._id],
          createdBy: ctx.actor,
        });
        await Ticket.updateOne({ _id: t._id }, { $set: { incident: incident._id } });
        emit('incident.created', { company: ctx.company, incidentId: incident._id, number: incident.number });
      }
      break;
    }
    case 'link_asset':
      if (t && cfg.assetId) {
        await Ticket.updateOne({ _id: t._id }, { $set: { asset: cfg.assetId } });
      }
      break;
    case 'call_api':
      if (cfg.url) {
        try {
          await fetch(cfg.url, {
            method: cfg.method || 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: cfg.token ? `Bearer ${cfg.token}` : '' },
            body: cfg.body ? JSON.stringify(typeof cfg.body === 'string' ? { text: cfg.body } : cfg.body) : JSON.stringify({ ticketNumber: t?.number }),
            signal: AbortSignal.timeout(15000),
          });
        } catch (err) {
          // ignore
        }
      }
      break;
    default:
      break;
  }
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function runWorkflow(workflow, payload) {
  const ctx = await loadContext({ ...payload, event: workflow.event });
  if (!ctx.ticket && workflow.conditions.some((c) => ['priority', 'status', 'dept', 'topic', 'source', 'subject', 'sentiment', 'language', 'entitlement', 'waiting_on', 'is_overdue'].includes(c.field))) {
    return false;
  }
  if (!(await evalConditions(workflow, ctx))) return false;

  const actions = [...(workflow.actions || [])].sort((a, b) => (a.delayMinutes || 0) - (b.delayMinutes || 0));
  for (const action of actions) {
    try {
      if (action.delayMinutes && action.delayMinutes > 0) {
        scheduleDelayed(workflow, action, ctx);
      } else {
        await executeAction(action, ctx);
      }
    } catch (err) {
      // one bad action must not kill the workflow
    }
  }
  await Workflow.updateOne({ _id: workflow._id }, { $inc: { runCount: 1 }, $set: { lastRunAt: new Date() } });
  return true;
}

const delayedTimers = new Map();
const scheduleDelayed = (workflow, action, ctx) => {
  const key = `${workflow._id}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
  const timer = setTimeout(async () => {
    delayedTimers.delete(key);
    try {
      await executeAction(action, ctx);
    } catch (err) {
      // ignore
    }
  }, action.delayMinutes * 60000);
  delayedTimers.set(key, timer);
};

const handleEvent = async (eventName, payload) => {
  try {
    const company = payload.company || null;
    const query = { isActive: true, event: eventName };
    if (company) query.company = company;
    const workflows = await Workflow.find(query).sort({ createdAt: 1 });
    for (const wf of workflows) {
      await runWorkflow(wf, payload);
    }
  } catch (err) {
    // ignore workflow errors
  }
};

/**
 * Run workflows that trigger on a repeating schedule (event: 'schedule.timer').
 * Trigger filter: { everyMinutes: N } runs when now % N < interval
 */
const runScheduleTimers = async () => {
  try {
    const workflows = await Workflow.find({ isActive: true, event: 'schedule.timer' });
    const config = require('../config/config');
    const interval = config.workflow.timerIntervalMinutes || 5;
    for (const wf of workflows) {
      const every = wf.triggerFilters?.everyMinutes || 60;
      const slot = Math.floor(Date.now() / (every * 60000));
      if (slot % (every / interval) === 0 || every <= interval) {
        await runWorkflow(wf, { company: wf.company });
      }
    }
  } catch (err) {
    // ignore
  }
};

const initWorkflowEngine = () => {
  if (initialized) return;
  initialized = true;
  for (const eventName of require('./events').EVENT_NAMES) {
    bus.on(eventName, (payload) => handleEvent(eventName, payload));
  }
  const config = require('../config/config');
  setInterval(() => runScheduleTimers().catch(() => {}), (config.workflow.timerIntervalMinutes || 5) * 60000);
};

module.exports = { initWorkflowEngine, runWorkflow, handleEvent, runScheduleTimers, executeAction };