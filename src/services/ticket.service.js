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
const { computeDueDate, resumeSla } = require('./sla.service');
const emailService = require('./email.service');
const { notifyAgent, notifyUser, notifyAdminRoom } = require('./notification.service');
const { getIO } = require('../config/socket');
const { emit } = require('./events');
const config = require('../config/config');
const logger = require('../utils/logger');
const auditService = require('./audit.service');

const audit = (args) => auditService.audit(args).catch(() => {});

const resolveDepartment = async (helpTopic, companyId = null) => {
  const scope = { status: 'active' };
  if (companyId) scope.company = companyId;
  if (helpTopic && helpTopic.department) {
    const dept = await Department.findById(helpTopic.department);
    if (dept && dept.status === 'active' && (!companyId || !dept.company || String(dept.company) === String(companyId))) return dept;
  }
  const settings = await SystemSetting.getSettings();
  if (settings.system.defaultDept) {
    const dept = await Department.findById(settings.system.defaultDept);
    if (dept && dept.status === 'active' && (!companyId || !dept.company || String(dept.company) === String(companyId))) return dept;
  }
  return Department.findOne(scope);
};

const applyFilters = async ({ ticket, topic, subject, body, userEmail, userName, priority, companyId }) => {
  const filterQuery = { status: 'active' };
  if (companyId) filterQuery.company = companyId;
  const filters = await TicketFilter.find(filterQuery).sort({ order: 1 });
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

const findOrCreateUser = async ({ name, email, phone, registerPassword, organization, company }) => {
  email = (email || '').toLowerCase().trim();
  let user = company
    ? await User.findOne({ email, company })
    : await User.findOne({ email, company: null });
  if (user) {
    if (company && !user.company) user.company = company;
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
    company: company || null,
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

const createTicket = async ({ user, orgOwner, createdBy, subject, details, topicId, priority, deptId, source = 'web', attachments = [], customData = {} }) => {
  const companyId = user?.company || null;
  const helpTopic = topicId ? await HelpTopic.findById(topicId) : null;
  if (helpTopic && companyId && helpTopic.company && String(helpTopic.company) !== String(companyId)) {
    throw new Error('Invalid help topic for this tenant');
  }
  let dept = deptId ? await Department.findById(deptId) : null;
  if (dept && companyId && dept.company && String(dept.company) !== String(companyId)) dept = null;
  if (!dept) dept = await resolveDepartment(helpTopic, companyId);

  const filterActions = await applyFilters({
    ticket: null,
    topic: helpTopic,
    subject,
    body: details,
    userEmail: user.email,
    userName: user.name,
    priority: priority || helpTopic?.priority || 'Normal',
    companyId,
  });

  if (filterActions.reject) {
    throw Object.assign(new Error('Ticket rejected by filter rules'), { rejected: true });
  }

  let targetDept = dept;
  if (filterActions.dept) {
    const fd = await Department.findById(filterActions.dept);
    if (fd && (!companyId || !fd.company || String(fd.company) === String(companyId))) targetDept = fd;
  }

  let targetPriority = priority || helpTopic?.priority || 'Normal';
  if (filterActions.priority) targetPriority = filterActions.priority;

  let targetSla = helpTopic?.sla || dept?.sla || null;
  if (filterActions.sla) targetSla = filterActions.sla;
  if (!targetSla && user.organization) {
    const org = await require('../models/Organization').findById(user.organization).lean();
    if (org?.sla) targetSla = org.sla;
  }

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

  // ---- Enterprise: entitlement evaluation (soft gate; records coverage) ----
  let entitlementStatus = 'unknown';
  let contractId = null;
  let slaOverride = null;
  try {
    const entitlementService = require('./entitlement.service');
    const evalResult = await entitlementService.evaluateEntitlement({
      company: companyId,
      user,
      helpTopicId: helpTopic?._id || null,
      serviceType: 'help_topic',
    });
    entitlementStatus = evalResult.status;
    contractId = evalResult.contract?._id || null;
    slaOverride = evalResult.slaOverride || null;
    if (slaOverride) targetSla = slaOverride;
    if (contractId && entitlementStatus === 'covered') {
      entitlementService.consumeEntitlement({ company: companyId, contractId, orgId: user.organization, helpTopicId: helpTopic?._id || null }).catch(() => {});
    }
  } catch (err) {
    // entitlement engine must never block ticket creation
  }

  // ---- Enterprise: smart routing (skill-based / round-robin / least-workload) ----
  const routingAlgorithm = settings.routing?.algorithm || 'skill_based';
  if (autoAssign && !targetAgent && !targetTeam && routingAlgorithm !== 'none') {
    try {
      const routing = require('./routing.service');
      const skills = await routing.skillsForTopic(helpTopic?._id);
      const slaPlan = targetSla ? await require('../models/SlaPlan').findById(targetSla).lean() : null;
      const best = await routing.findBestAgent({
        company: companyId,
        deptId: targetDept?._id,
        requiredSkills: skills,
        priority: targetPriority,
        slaHours: slaPlan?.gracePeriod || 0,
        algorithm: routingAlgorithm,
      });
      if (best) targetAgent = best._id;
    } catch (err) {
      // routing fallback: no assignment
    }
  }

  const dueDate = await computeDueDate(targetSla, new Date(), { slaType: 'first_response' });

  const ticket = await Ticket.create({
    number: generateTicketNumber(),
    company: companyId,
    user: orgOwner || user._id,
    createdBy: createdBy || null,
    dept: targetDept?._id || null,
    topic: helpTopic?._id || null,
    priority: targetPriority,
    sla: targetSla,
    agent: targetAgent,
    team: targetTeam,
    subject,
    source,
    dueDate,
    slaStartedAt: new Date(),
    lastActivity: new Date(),
    lastMessageAt: new Date(),
    customData: customData || {},
    entitlementStatus,
    contract: contractId,
  });

  await TicketThread.create({
    ticket: ticket._id,
    company: companyId,
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
      company: companyId,
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
          company: companyId,
          type: 'new_ticket',
          message: `New ticket ${ticket.number} assigned to team ${teamDoc.name}`,
          link: `/tickets/${ticket.number}`,
          ticket: ticket._id,
        });
      }
    }
  }
  const deptAgents = await Agent.find({ 'departments.department': targetDept?._id, isActive: true, ...(companyId ? { company: companyId } : {}) });
  if (settings.tickets?.notifyNewTicketToDept) {
    for (const a of deptAgents) {
      if (!targetAgent || String(a._id) !== String(targetAgent)) {
        await notifyAgent({
          agentId: a._id,
          company: companyId,
          type: 'new_ticket',
          message: `New ticket ${ticket.number} in ${targetDept?.name || 'Support'}: ${ticket.subject}`,
          link: `/tickets/${ticket.number}`,
          ticket: ticket._id,
        });
      }
    }
  }
  await notifyAdminRoom({ type: 'new_ticket', message: `New ticket ${ticket.number}: ${ticket.subject}`, link: `/tickets/${ticket.number}`, ticket: ticket._id, company: companyId });

  // Emails
  const ctx = await buildTicketContext(ticket);
  const autoresp = settings.autoresponder || {};
  const topicResp = helpTopic?.autoresponder || {};
  const useTopicResp = topicResp.enabled === true && (topicResp.subject || topicResp.body);
  const autoSubject = useTopicResp ? topicResp.subject : autoresp.subject;
  const autoBody = useTopicResp ? topicResp.body : autoresp.body;
  try {
    if ((autoresp.enabled !== false || useTopicResp) && (settings.tickets?.autoResponder !== false)) {
      if (autoSubject || autoBody) {
        const render = (tpl) => tpl.replace(/\[([\w.]+)\]/g, (m, key) => key.split('.').reduce((o, k) => (o == null ? '' : o[k]), ctx) ?? '');
        await emailService.sendMail({
          to: user.email,
          subject: autoSubject ? render(autoSubject) : ctx.subject,
          body: autoBody ? render(autoBody) : '',
          event: 'new_ticket_confirmation',
          ticket: ticket._id,
          user: user._id,
          company: companyId,
        });
      } else {
        await emailService.sendFromTemplate({
          key: 'new_ticket_confirmation',
          to: user.email,
          data: ctx,
          event: 'new_ticket_confirmation',
          ticket: ticket._id,
          user: user._id,
          company: companyId,
        });
      }
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
          company: companyId,
        });
      }
    }
  } catch (err) {
    logger.error(`Alert email failed: ${err.message}`);
  }

  // ---- Enterprise: platform events + AI intelligence (async, non-blocking) ----
  emit('ticket.created', {
    company: companyId,
    ticketId: ticket._id,
    ticketNumber: ticket.number,
    subject: ticket.subject,
    priority: ticket.priority,
    source: ticket.source,
    userId: user._id,
    actor: createdBy || null,
  });
  audit({
    company: companyId,
    actorType: createdBy ? 'agent' : 'user',
    actor: createdBy || user._id || null,
    actorName: createdBy ? String(createdBy) : `${user.name} <${user.email}>`,
    action: 'ticket.created',
    entityType: 'ticket',
    entityId: ticket._id,
    after: { number: ticket.number, subject: ticket.subject, priority: ticket.priority, source },
  });
  const realtime = require('./realtime.service');
  realtime.broadcastSnapshot({ company: companyId }).catch(() => {});

  return ticket;
};

const addThreadEntry = async ({ ticket, type = 'message', posterType, user, agent, body, title, attachments = [], systemMessage }) => {
  const entry = await TicketThread.create({
    ticket: ticket._id,
    company: ticket.company || null,
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
      // agent responded -> SLA resumes from pause
      if (ticket.slaPaused) await resumeSla(ticket);
      emit('ticket.replied', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number, actor: agent?._id || null });
    } else if (posterType === 'user') {
      ticket.stats.messages += 1;
      ticket.lastMessageAt = new Date();
      // customer responded -> SLA resumes from pause
      if (ticket.slaPaused) await resumeSla(ticket);
      emit('customer.replied', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number });
    }
    await ticket.save();
  }

  return entry;
};

const addSystemEvent = async ({ ticket, message }) => {
  return TicketThread.create({
    ticket: ticket._id,
    company: ticket.company || null,
    type: 'system',
    posterType: 'system',
    title: 'System',
    systemMessage: message,
    isSystem: true,
  });
};

/**
 * Fire post-close hooks: platform event + CSAT survey (if enabled).
 */
const handleTicketClosed = async (ticket, opts = {}) => {
  emit('ticket.closed', {
    company: ticket.company,
    ticketId: ticket._id,
    ticketNumber: ticket.number,
    actor: opts.actor || null,
    agentId: ticket.agent || null,
  });
  audit({
    company: ticket.company,
    actorType: opts.actor ? 'agent' : 'system',
    actor: opts.agentId || opts.actor || null,
    actorName: opts.actor ? String(opts.actor) : 'auto-close',
    action: 'ticket.closed',
    entityType: 'ticket',
    entityId: ticket._id,
    after: { number: ticket.number, status: 'closed' },
  });
  try {
    const csat = require('./csat.service');
    const settings = await SystemSetting.getSettings();
    if (settings.csat?.enabled !== false) {
      csat.sendSurveyForTicket(ticket, { trigger: 'on_close' }).catch(() => {});
    }
  } catch (err) {
    // ignore
  }
  try {
    const realtime = require('./realtime.service');
    realtime.broadcastSnapshot({ company: ticket.company }).catch(() => {});
  } catch (err) {
    // ignore
  }
};

/**
 * Fire post-reopen hooks + CSAT reset.
 */
const handleTicketReopened = async (ticket) => {
  emit('ticket.reopened', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number });
  if (ticket.csatRating) {
    await Ticket.updateOne({ _id: ticket._id }, { $set: { csatRating: null, csatComment: '', csatSentAt: null } }).catch(() => {});
  }
};

module.exports = {
  createTicket,
  addThreadEntry,
  addSystemEvent,
  buildTicketContext,
  findOrCreateUser,
  applyFilters,
  resolveDepartment,
  handleTicketClosed,
  handleTicketReopened,
};
