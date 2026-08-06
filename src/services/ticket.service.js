const User = require('../models/User');
const Ticket = require('../models/Ticket');
const TicketThread = require('../models/TicketThread');
const HelpTopic = require('../models/HelpTopic');
const Department = require('../models/Department');
const Team = require('../models/Team');
const Agent = require('../models/Agent');
const TicketFilter = require('../models/TicketFilter');
const SystemSetting = require('../models/SystemSetting');
const { generateTicketNumber, generateConfirmationToken } = require('../utils/generators');
const { computeDueDate } = require('./sla.service');
const emailService = require('./email.service');
const { notifyAgent, notifyUser, notifyAdminRoom } = require('./notification.service');
const { getIO } = require('../config/socket');
const config = require('../config/config');
const logger = require('../utils/logger');

const resolveDepartment = async (helpTopic) => {
  if (helpTopic && helpTopic.department) {
    const dept = await Department.findById(helpTopic.department);
    if (dept && dept.status === 'active') return dept;
  }
  const settings = await SystemSetting.getSettings();
  if (settings.system.defaultDept) {
    const dept = await Department.findById(settings.system.defaultDept);
    if (dept && dept.status === 'active') return dept;
  }
  return Department.findOne({ status: 'active' });
};

const applyFilters = async ({ ticket, topic, subject, body, userEmail, userName, priority }) => {
  const filters = await TicketFilter.find({ status: 'active' }).sort({ order: 1 });
  const actions = { dept: null, agent: null, team: null, priority: null, sla: null, canned: null, reject: false };
  for (const filter of filters) {
    let matched = false;
    if (filter.match === 'all') {
      matched = filter.rules.every((r) => matchRule(r, { subject, body, userEmail, userName, priority, topic }));
    } else {
      matched = filter.rules.some((r) => matchRule(r, { subject, body, userEmail, userName, priority, topic }));
    }
    if (matched) {
      for (const action of filter.actions) {
        switch (action.action) {
          case 'dept':
            if (!actions.dept) actions.dept = action.target;
            break;
          case 'agent':
            if (!actions.agent) actions.agent = action.target;
            break;
          case 'team':
            if (!actions.team) actions.team = action.target;
            break;
          case 'priority':
            if (!actions.priority) actions.priority = action.target;
            break;
          case 'sla':
            if (!actions.sla) actions.sla = action.target;
            break;
          case 'reject':
            actions.reject = true;
            break;
          case 'canned_response':
            if (!actions.canned) actions.canned = action.target;
            break;
          default:
            break;
        }
      }
    }
  }
  return actions;
};

const matchRule = (rule, ctx) => {
  let field = '';
  switch (rule.field) {
    case 'subject': field = ctx.subject || ''; break;
    case 'body': field = ctx.body || ''; break;
    case 'from': field = ctx.userEmail || ''; break;
    case 'name': field = ctx.userName || ''; break;
    case 'priority': field = ctx.priority || ''; break;
    case 'topic': field = typeof ctx.topic === 'object' ? ctx.topic?.topic : ctx.topic || ''; break;
    default: field = '';
  }
  const value = String(rule.value || '').toLowerCase();
  field = String(field).toLowerCase();
  switch (rule.method) {
    case 'contains': return field.includes(value);
    case 'equals': return field === value;
    case 'starts_with': return field.startsWith(value);
    case 'ends_with': return field.endsWith(value);
    case 'regex':
      try { return new RegExp(rule.value).test(String(field)); } catch (e) { return false; }
    default: return false;
  }
};

const findOrCreateUser = async ({ name, email, phone, registerPassword, organization }) => {
  email = (email || '').toLowerCase().trim();
  let user = await User.findOne({ email });
  if (user) {
    if (registerPassword) user.password = registerPassword;
    if (!user.isRegistered && registerPassword) {
      user.isRegistered = true;
      user.emailConfirmed = true;
    }
    if (phone && !user.phone) user.phone = phone;
    if (name && user.name !== name) user.name = name;
    await user.save();
    return user;
  }
  const isRegistered = !!(registerPassword);
  user = await User.create({
    name: name || email.split('@')[0],
    email,
    phone: phone || '',
    password: registerPassword || null,
    isRegistered,
    emailConfirmed: isRegistered,
    confirmationToken: isRegistered ? null : generateConfirmationToken(),
    organization: organization || null,
  });
  return user;
};

const buildTicketContext = async (ticket) => {
  const [user, topic, dept, sla, agent, team, settings] = await Promise.all([
    User.findById(ticket.user),
    HelpTopic.findById(ticket.topic),
    Department.findById(ticket.dept),
    ticket.sla ? require('../models/SlaPlan').findById(ticket.sla) : null,
    Agent.findById(ticket.agent),
    Team.findById(ticket.team),
    SystemSetting.getSettings(),
  ]);
  const company = settings.company || {};
  return {
    ticket: {
      number: ticket.number,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      created: ticket.createdAt,
      due: ticket.dueDate,
    },
    user: {
      name: user?.name || '',
      email: user?.email || '',
      first: user?.name?.split(' ')[0] || '',
      phone: user?.phone || '',
    },
    dept: { name: dept?.name || '' },
    topic: { name: topic?.topic || '' },
    sla: { name: sla?.name || '' },
    agent: { name: agent?.name || '' },
    team: { name: team?.name || '' },
    company: {
      name: company.name || 'My Support Center',
      email: company.email || '',
      phone: company.phone || '',
      url: company.url || config.urls.client,
    },
    urls: {
      ticket: `${config.urls.client}/ticket/${ticket.number}`,
      agent: `${config.urls.agent}/tickets/${ticket.number}`,
      admin: config.urls.admin,
      home: config.urls.client,
    },
  };
};

const createTicket = async ({ user, subject, details, topicId, priority, deptId, source = 'web', attachments = [], customData = {} }) => {
  const helpTopic = topicId ? await HelpTopic.findById(topicId) : null;
  let dept = deptId ? await Department.findById(deptId) : null;
  if (!dept) dept = await resolveDepartment(helpTopic);

  const filterActions = await applyFilters({
    ticket: null,
    topic: helpTopic,
    subject,
    body: details,
    userEmail: user.email,
    userName: user.name,
    priority: priority || helpTopic?.priority || 'Normal',
  });

  if (filterActions.reject) {
    throw Object.assign(new Error('Ticket rejected by filter rules'), { rejected: true });
  }

  let targetDept = dept;
  if (filterActions.dept) {
    const fd = await Department.findById(filterActions.dept);
    if (fd) targetDept = fd;
  }

  let targetPriority = priority || helpTopic?.priority || 'Normal';
  if (filterActions.priority) targetPriority = filterActions.priority;

  let targetSla = helpTopic?.sla || dept?.sla || null;
  if (filterActions.sla) targetSla = filterActions.sla;

  let targetAgent = helpTopic?.autoAssignAgent || dept?.autoAssignAgent || null;
  if (filterActions.agent) targetAgent = filterActions.agent;

  let targetTeam = helpTopic?.autoAssignTeam || dept?.autoAssignTeam || null;
  if (filterActions.team) targetTeam = filterActions.team;

  const settings = await SystemSetting.getSettings();
  const autoAssign = settings.tickets?.autoAssign !== false;
  if (!autoAssign) {
    targetAgent = null;
    targetTeam = null;
  }

  const dueDate = await computeDueDate(targetSla);

  const ticket = await Ticket.create({
    number: generateTicketNumber(),
    user: user._id,
    dept: targetDept?._id || null,
    topic: helpTopic?._id || null,
    priority: targetPriority,
    sla: targetSla,
    agent: targetAgent,
    team: targetTeam,
    subject,
    source,
    dueDate,
    lastActivity: new Date(),
    lastMessageAt: new Date(),
    customData: customData || {},
  });

  await TicketThread.create({
    ticket: ticket._id,
    type: 'message',
    posterType: 'user',
    user: user._id,
    title: 'Message',
    body: details || '',
    attachments: attachments || [],
  });

  const status = targetAgent || targetTeam ? Ticket.STATUSES.ASSIGNED : Ticket.STATUSES.OPEN;
  if (ticket.status !== status) ticket.status = status;
  await ticket.save();

  // Notifications
  if (targetAgent) {
    const agentDoc = await Agent.findById(targetAgent);
    await notifyAgent({
      agentId: targetAgent,
      type: 'new_ticket',
      message: `New ticket ${ticket.number} assigned to you: ${ticket.subject}`,
      link: `/tickets/${ticket.number}`,
      ticket: ticket._id,
    });
  }
  if (targetTeam) {
    const teamDoc = await Team.findById(targetTeam).populate('members');
    const members = teamDoc?.members || [];
    for (const m of members) {
      if (String(m._id) !== String(targetAgent)) {
        await notifyAgent({
          agentId: m._id,
          type: 'new_ticket',
          message: `New ticket ${ticket.number} assigned to team ${teamDoc.name}`,
          link: `/tickets/${ticket.number}`,
          ticket: ticket._id,
        });
      }
    }
  }
  const deptAgents = await Agent.find({ 'departments.department': targetDept?._id, isActive: true });
  if (settings.tickets?.notifyNewTicketToDept) {
    for (const a of deptAgents) {
      if (!targetAgent || String(a._id) !== String(targetAgent)) {
        await notifyAgent({
          agentId: a._id,
          type: 'new_ticket',
          message: `New ticket ${ticket.number} in ${targetDept?.name || 'Support'}: ${ticket.subject}`,
          link: `/tickets/${ticket.number}`,
          ticket: ticket._id,
        });
      }
    }
  }
  await notifyAdminRoom({ type: 'new_ticket', message: `New ticket ${ticket.number}: ${ticket.subject}`, link: `/tickets/${ticket.number}`, ticket: ticket._id });

  // Emails
  const ctx = await buildTicketContext(ticket);
  try {
    if (settings.tickets?.autoResponder !== false) {
      await emailService.sendFromTemplate({
        key: 'new_ticket_confirmation',
        to: user.email,
        data: ctx,
        event: 'new_ticket_confirmation',
        ticket: ticket._id,
        user: user._id,
      });
    }
  } catch (err) {
    logger.error(`Confirmation email failed: ${err.message}`);
  }
  try {
    if (settings.tickets?.notifyNewTicketToDept !== false) {
      const recipients = new Set();
      if (targetAgent) recipients.add(String(targetAgent));
      if (deptAgents.length && !targetAgent) deptAgents.forEach((a) => recipients.add(String(a._id)));
      for (const rid of recipients) {
        const agentDoc = await Agent.findById(rid);
        if (!agentDoc) continue;
        await emailService.sendFromTemplate({
          key: 'new_ticket_alert',
          to: agentDoc.email,
          data: { ...ctx, recipient: { name: agentDoc.name } },
          event: 'new_ticket_alert',
          ticket: ticket._id,
          user: user._id,
        });
      }
    }
  } catch (err) {
    logger.error(`Alert email failed: ${err.message}`);
  }

  return ticket;
};

const addThreadEntry = async ({ ticket, type = 'message', posterType, user, agent, body, title, attachments = [], systemMessage }) => {
  const entry = await TicketThread.create({
    ticket: ticket._id,
    type,
    posterType,
    user: user?._id || null,
    agent: agent?._id || null,
    title: title || (posterType === 'agent' ? 'Response' : 'Message'),
    body: body || '',
    systemMessage: systemMessage || '',
    attachments,
  });

  if (type === 'message' || type === 'note') {
    ticket.lastActivity = new Date();
    if (posterType === 'agent' && type === 'message') {
      ticket.stats.responses += 1;
      if (!ticket.stats.firstResponseAt) ticket.stats.firstResponseAt = new Date();
      ticket.lastMessageAt = new Date();
      if (ticket.status === Ticket.STATUSES.OPEN || ticket.status === Ticket.STATUSES.OVERDUE) {
        ticket.status = Ticket.STATUSES.OPEN;
        ticket.isOverdue = false;
      }
    } else if (posterType === 'user') {
      ticket.stats.messages += 1;
      ticket.lastMessageAt = new Date();
    }
    await ticket.save();
  }

  return entry;
};

const addSystemEvent = async ({ ticket, message }) => {
  return TicketThread.create({
    ticket: ticket._id,
    type: 'system',
    posterType: 'system',
    title: 'System',
    systemMessage: message,
    isSystem: true,
  });
};

module.exports = {
  createTicket,
  addThreadEntry,
  addSystemEvent,
  buildTicketContext,
  findOrCreateUser,
  applyFilters,
  resolveDepartment,
};
