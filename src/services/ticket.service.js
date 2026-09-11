const User = require('../models/User');
const Ticket = require('../models/helpdesk/tickets/Ticket');
const TicketThread = require('../models/helpdesk/tickets/TicketThread');
const HelpTopic = require('../models/HelpTopic');
const Department = require('../models/Department');
const Team = require('../models/Team');
const Agent = require('../models/Agent');
const TicketFilter = require('../models/helpdesk/tickets/TicketFilter');
const SystemSetting = require('../models/SystemSetting');
const { generateConfirmationToken } = require('../utils/generators');
const { nextTicketNumber } = require('./numbering.service');
const { computeDueDate, resumeSla } = require('./sla.service');
const emailService = require('./email.service');
const { notifyAgent, notifyUser, notifyAdminRoom } = require('./notification.service');
const { getIO } = require('../config/socket');
const { emit } = require('./events');
const config = require('../config/config');
const logger = require('../utils/logger');
const auditService = require('./audit.service');
const ApiError = require('../utils/ApiError');
const TicketStatus = require('../models/helpdesk/tickets/TicketStatus');
const { assertTransition } = require('./stateMachine.service');

const auditRequired = (args) => auditService.auditRequired(args);

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

const applyFilters = async ({ ticket, topic, subject, body, userEmail, userName, priority, companyId, toAddresses = [] }) => {
  const filterQuery = { status: 'active' };
  if (companyId) filterQuery.company = companyId;
  const filters = await TicketFilter.find(filterQuery).sort({ order: 1 });
  const actions = { dept: null, agent: null, team: null, priority: null, sla: null, canned: null, reject: false };
  const ruleCtx = { subject, body, userEmail, userName, priority, topic, toAddrs: toAddresses };
  for (const filter of filters) {
    let matched = false;
    if (filter.match === 'all') {
      matched = filter.rules.every((r) => matchRule(r, ruleCtx));
    } else {
      matched = filter.rules.some((r) => matchRule(r, ruleCtx));
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
    case 'to': field = (ctx.toAddrs || []).join(' '); break;
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

const findOrCreateUser = async ({ name, email, phone, registerPassword, organization, company, userType }) => {
  email = (email || '').toLowerCase().trim();
  if (registerPassword) {
    const { assertPasswordPolicy } = require('../utils/passwordPolicy');
    await assertPasswordPolicy(registerPassword, company || null);
  }
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
    userType: userType === 'external' ? 'external' : 'employee',
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

const MATRIX_PRIORITY_MAP = { critical: 'Emergency', high: 'High', medium: 'Normal', low: 'Low' };

/**
 * Impact × Urgency → Priority (§13). Tenant matrix first, global default
 * matrix as fallback. Returns null when inputs are absent/invalid.
 */
const computeMatrixPriority = async ({ companyId, impact, urgency }) => {
  if (!impact || !urgency) return null;
  const valid = ['low', 'medium', 'high'];
  if (!valid.includes(impact) || !valid.includes(urgency)) return null;
  try {
    const PriorityMatrix = require('../models/platformIdentity/PriorityMatrix');
    const cell = (await PriorityMatrix.findOne({ tenantId: companyId, impact, urgency }).lean())
      || (await PriorityMatrix.findOne({ tenantId: { $exists: false }, impact, urgency }).lean())
      || (await PriorityMatrix.findOne({ impact, urgency }).lean());
    if (!cell?.priority) return null;
    return MATRIX_PRIORITY_MAP[cell.priority] || null;
  } catch (_) {
    return null;
  }
};

const createTicket = async ({ user, orgOwner, createdBy, subject, details, topicId, priority, impact, urgency, deptId, sla = null, source = 'web', attachments = [], customData = {}, toAddresses = [], skipRouting = false, auditActorType = 'user', auditActorId = null, auditActorName = '', req = null }) => {
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
    toAddresses,
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
  // Impact × Urgency wins over a stated priority (§13): customers don't get
  // to self-declare P1 — the matrix decides.
  if (impact || urgency) {
    const matrixPriority = await computeMatrixPriority({ companyId, impact, urgency });
    if (matrixPriority) targetPriority = matrixPriority;
  }

  let targetSla = sla || helpTopic?.sla || dept?.sla || null;
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
  if (!skipRouting && autoAssign && !targetAgent && !targetTeam && routingAlgorithm !== 'none') {
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
        customerTier: user.tier || 'standard',
        algorithm: routingAlgorithm,
      });
      if (best) targetAgent = best._id;
    } catch (err) {
      // routing fallback: no assignment
    }
  }

  const { startClocks } = require('./sla.service');
  const clocks = await startClocks(targetSla, new Date(), { company: companyId });

  const ticket = await Ticket.create({
    number: await nextTicketNumber(),
    company: companyId,
    user: orgOwner || user._id,
    createdBy: createdBy || null,
    dept: targetDept?._id || null,
    topic: helpTopic?._id || null,
    priority: targetPriority,
    impact: impact || null,
    urgency: urgency || null,
    sla: targetSla,
    agent: targetAgent,
    team: targetTeam,
    subject,
    source,
    dueDate: clocks.resolutionDue,
    responseDueAt: clocks.responseDue,
    resolutionDueAt: clocks.resolutionDue,
    slaStartedAt: new Date(),
    lastActivity: new Date(),
    lastMessageAt: new Date(),
    customData: customData || {},
    entitlementStatus,
    contract: contractId,
  });
  if (targetSla) await require('./sla.service').recordSlaEvent(ticket, 'started', 'all', { metadata: { responseDueAt: clocks.responseDue, resolutionDueAt: clocks.resolutionDue } });

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

  // Learned auto-routing: if no agent assigned and department set, try learned routing
  if (!skipRouting && !ticket.agent && ticket.dept) {
    try {
      const { autoRoute } = require('./learnedRouting.service');
      const route = await autoRoute({ company: companyId, departmentId: ticket.dept, subject: ticket.subject, details, priority: ticket.priority });
      if (route && route.agentId) {
        ticket.agent = route.agentId;
        ticket.status = Ticket.STATUSES.ASSIGNED;
        await ticket.save();
      }
    } catch (_) { /* routing failure is non-fatal */ }
  }

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
  await auditRequired({
    company: companyId,
    actorType: auditActorType,
    actor: auditActorId || user._id || null,
    actorName: auditActorName || `${user.name} <${user.email}>`,
    action: 'ticket.created',
    entityType: 'ticket',
    entityId: ticket._id,
    after: { number: ticket.number, subject: ticket.subject, priority: ticket.priority, source },
    req,
  });
  const realtime = require('./realtime.service');
  realtime.broadcastSnapshot({ company: companyId }).catch(() => {});

  return ticket;
};

const addThreadEntry = async ({ ticket, type = 'message', posterType, user, agent, body, title, attachments = [], systemMessage, auditContext = null }) => {
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
    let reopenedByCustomerReply = false;
    const statusBeforeReply = ticket.status;
    if (posterType === 'agent' && type === 'message') {
      ticket.stats.responses += 1;
      if (!ticket.stats.firstResponseAt) ticket.stats.firstResponseAt = new Date();
      if (!ticket.responseMetAt) {
        ticket.responseMetAt = new Date();
        await require('./sla.service').recordSlaEvent(ticket, ticket.responseDueAt && ticket.responseMetAt > ticket.responseDueAt ? 'breached' : 'met', 'first_response', { completedAt: ticket.responseMetAt, durationMs: ticket.responseMetAt - new Date(ticket.slaStartedAt || ticket.createdAt) });
      }
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
      // Customer reply reopens resolved/closed tickets (lifecycle §22/§40)
      // inside the configured window — covers portal AND email replies.
      if (ticket.status === Ticket.STATUSES.RESOLVED || ticket.status === Ticket.STATUSES.CLOSED) {
        try {
          const reopenSettings = await SystemSetting.getSettings();
          if (reopenSettings.system?.allowTicketReopen !== false && reopenWindowAllows(ticket, reopenSettings)) {
            ticket.status = Ticket.STATUSES.OPEN;
            ticket.stats.reopened += 1;
            ticket.closedAt = null;
            ticket.closedBy = null;
            ticket.resolvedAt = null;
            ticket.resolvedBy = null;
            ticket.resolutionMetAt = null;
            reopenedByCustomerReply = true;
          }
        } catch (_) { /* reopen check must never block the reply */ }
      }
      emit('customer.replied', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number });
    }
    await ticket.save();
    if (reopenedByCustomerReply) {
      await addSystemEvent({ ticket, message: 'Ticket reopened by customer reply' });
      await handleTicketReopened(ticket);
      await auditRequired({
        company: ticket.company,
        actorType: auditContext?.actorType || 'user',
        actor: auditContext?.actorId || user?._id || null,
        actorName: auditContext?.actorName || user?.name || 'customer',
        action: 'ticket.status_changed',
        entityType: 'ticket',
        entityId: ticket._id,
        before: { status: statusBeforeReply },
        after: { status: ticket.status },
        reason: 'reopened by customer reply',
        req: auditContext?.req || null,
      });
    }
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
  await auditRequired({
    company: ticket.company,
    actorType: opts.actorType || (opts.actor ? 'agent' : 'system'),
    actor: opts.actorId || opts.agentId || opts.actor || null,
    actorName: opts.actorName || (opts.actor ? String(opts.actor) : 'auto-close'),
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
 * Reopen windows (§40): a customer reply reopens inside the window —
 * reopenWindowDays for resolved (default 7), closedReopenWindowDays for
 * closed (default 60). Outside it, reply entry points create a new ticket
 * linked to the previous one instead.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const reopenWindowAllows = (ticket, settings) => {
  const now = Date.now();
  if (ticket.status === Ticket.STATUSES.RESOLVED) {
    const days = Number(settings?.tickets?.reopenWindowDays ?? 7);
    if (!ticket.resolvedAt) return true;
    return now - new Date(ticket.resolvedAt).getTime() <= days * DAY_MS;
  }
  if (ticket.status === Ticket.STATUSES.CLOSED) {
    const days = Number(settings?.tickets?.closedReopenWindowDays ?? 60);
    if (!ticket.closedAt) return true;
    return now - new Date(ticket.closedAt).getTime() <= days * DAY_MS;
  }
  return true;
};

/**
 * Creates a follow-up ticket linked (TicketLink `related`) to a resolved /
 * closed ticket whose reply window expired. Keeps history connected without
 * resurrecting ancient tickets.
 */
const createFollowUpTicket = async ({ ticket, user, body, attachments = [], source = 'web', actorId = null }) => {
  const orgOwner = user.createdBy || user._id;
  const created = await createTicket({
    user,
    orgOwner,
    createdBy: user._id,
    subject: `Follow-up: ${ticket.subject}`.slice(0, 200),
    details: body,
    topicId: ticket.topic || null,
    deptId: ticket.dept || null,
    priority: ticket.priority || 'Normal',
    source,
    attachments,
  });
  try {
    const TicketLink = require('../models/helpdesk/tickets/TicketLink');
    await TicketLink.create({
      company: ticket.company || null,
      from: created._id,
      to: ticket._id,
      type: 'related',
      createdBy: actorId,
    });
  } catch (_) { /* linking must never block creation */ }
  await addSystemEvent({ ticket, message: `Follow-up created as ticket ${created.number} (reply window expired)` });
  return created;
};
const handleTicketResolved = async (ticket, opts = {}) => {
  emit('ticket.resolved', {
    company: ticket.company,
    ticketId: ticket._id,
    ticketNumber: ticket.number,
    actor: opts.actor || null,
    agentId: ticket.resolvedBy || ticket.agent || null,
  });
  await auditRequired({
    company: ticket.company,
    actorType: opts.actorType || (opts.actor ? 'agent' : 'system'),
    actor: opts.actorId || opts.agentId || opts.actor || null,
    actorName: opts.actorName || (opts.actor ? String(opts.actor) : 'system'),
    action: 'ticket.resolved',
    entityType: 'ticket',
    entityId: ticket._id,
    after: { number: ticket.number, status: 'resolved' },
  });
  try {
    const realtime = require('./realtime.service');
    realtime.broadcastSnapshot({ company: ticket.company }).catch(() => {});
  } catch (err) {
    // ignore
  }
};

/**
 * Single + bulk status changes go through here so transitions, SLA pause,
 * mails, events and audit stay identical everywhere. Returns { ticket, prev }.
 * Throws ApiError(422) on unknown status or illegal transition.
 */
const applyStatusChange = async (ticket, status, { actorType = 'agent', actorId = null, actorName = 'System', reason = '', resolution = null, req = null } = {}) => {
  const builtIn = Object.values(Ticket.STATUSES);
  const configured = await TicketStatus.find({ isActive: true }).select('key pauseSla waitingOn isClosed');
  const customKeys = configured.map((s) => s.key);
  if (!new Set([...builtIn, ...customKeys]).has(status)) {
    throw new ApiError(422, 'Invalid status');
  }
  const prev = ticket.status;
  assertTransition('ticket', prev, status, customKeys);
  if (status === prev) return { ticket, prev, noop: true };
  ticket.status = status;

  // Resolution discipline (§41): resolving requires code + solution unless
  // the tenant disabled it. Stored on the ticket resolution record.
  if (status === Ticket.STATUSES.RESOLVED) {
    const resSettings = await SystemSetting.getSettings().catch(() => null);
    if (resSettings?.tickets?.requireResolution !== false) {
      const code = String(resolution?.code || '').trim();
      const solution = String(resolution?.solution || '').trim();
      if (!code || !solution) {
        throw new ApiError(422, 'Resolution code and solution are required to resolve a ticket');
      }
      ticket.resolution = {
        code,
        category: String(resolution?.category || '').trim(),
        rootCause: String(resolution?.rootCause || '').trim(),
        solution,
        workaround: String(resolution?.workaround || '').trim(),
        timeSpentMinutes: resolution?.timeSpentMinutes != null ? Number(resolution.timeSpentMinutes) : null,
        asset: resolution?.asset || null,
        kbArticle: resolution?.kbArticle || null,
      };
    } else if (resolution) {
      ticket.resolution = {
        code: String(resolution.code || ''),
        category: String(resolution.category || ''),
        rootCause: String(resolution.rootCause || ''),
        solution: String(resolution.solution || ''),
        workaround: String(resolution.workaround || ''),
        timeSpentMinutes: resolution.timeSpentMinutes != null ? Number(resolution.timeSpentMinutes) : null,
        asset: resolution.asset || null,
        kbArticle: resolution.kbArticle || null,
      };
    }
  }

  // Parent stays open until subtasks finish (§22).
  if (status === Ticket.STATUSES.RESOLVED || status === Ticket.STATUSES.CLOSED) {
    const taskSettings = await SystemSetting.getSettings().catch(() => null);
    if (taskSettings?.tickets?.blockCloseOnOpenTasks !== false) {
      const Task = require('../models/Task');
      const openTasks = await Task.countDocuments({ ticket: ticket._id, status: 'open' });
      if (openTasks > 0) {
        throw new ApiError(422, `Cannot ${status} — ${openTasks} open task(s) must finish first`);
      }
    }
  }

  if (status === Ticket.STATUSES.RESOLVED) {
    ticket.resolvedAt = new Date();
    ticket.resolvedBy = actorType === 'agent' ? actorId : null;
    ticket.resolutionMetAt = new Date();
    await require('./sla.service').recordSlaEvent(ticket, ticket.resolutionDueAt && ticket.resolutionMetAt > ticket.resolutionDueAt ? 'breached' : 'met', 'resolution', { completedAt: ticket.resolutionMetAt, durationMs: ticket.resolutionMetAt - new Date(ticket.slaStartedAt || ticket.createdAt) });
    ticket.isOverdue = false;
  } else if (status === Ticket.STATUSES.CLOSED) {
    ticket.closedAt = new Date();
    ticket.closedBy = actorType === 'agent' ? actorId : null;
    ticket.lockedBy = null;
    ticket.lockExpiresAt = null;
  } else if (prev === Ticket.STATUSES.CLOSED || prev === Ticket.STATUSES.RESOLVED) {
    if (prev === Ticket.STATUSES.CLOSED) {
      ticket.closedAt = null;
      ticket.closedBy = null;
    }
    ticket.resolvedAt = null;
    ticket.resolvedBy = null;
    ticket.resolutionMetAt = null;
    ticket.stats.reopened += 1;
  }

  // SLA pause/resume on configurable statuses
  const statusDef = configured.find((s) => s.key === status);
  const { pauseSla, resumeSla } = require('./sla.service');
  if (statusDef && statusDef.pauseSla) {
    await pauseSla(ticket, statusDef.waitingOn || 'customer');
  } else if (ticket.slaPaused) {
    await resumeSla(ticket);
  }
  if (status === Ticket.STATUSES.CLOSED && ticket.slaPaused) {
    await resumeSla(ticket);
  }

  await ticket.save();
  await addSystemEvent({
    ticket,
    message: `Status changed from ${prev} to ${status}${reason ? ` (${reason})` : ''} by ${actorName}`,
  });
  await auditRequired({
    company: ticket.company,
    actorType,
    actor: actorId,
    actorName,
    action: 'ticket.status_changed',
    entityType: 'ticket',
    entityId: ticket._id,
    before: { status: prev },
    after: { status },
    reason,
    req,
  });
  emit('ticket.status_changed', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number, from: prev, to: status, actor: actorId });

  const ctx = (status === Ticket.STATUSES.RESOLVED || status === Ticket.STATUSES.CLOSED)
    ? await buildTicketContext(ticket)
    : null;
  if (status === Ticket.STATUSES.RESOLVED) {
    try {
      if (ctx.user.email) {
        await emailService.sendFromTemplate({ key: 'ticket_resolved', to: ctx.user.email, data: ctx, event: 'ticket_resolved', ticket: ticket._id, user: ticket.user, company: ticket.company });
      }
    } catch (err) { /* non-blocking */ }
    const { notifyUser } = require('./notification.service');
    await notifyUser({ userId: ticket.user, company: ticket.company, type: 'status_change', message: `Your ticket ${ticket.number} has been resolved — reply if the issue remains`, link: `/ticket/${ticket.number}`, ticket: ticket._id }).catch(() => {});
    await handleTicketResolved(ticket, { actor: actorId, actorId, actorType, actorName, agentId: actorType === 'agent' ? actorId : ticket.agent });
  }
  if (status === Ticket.STATUSES.CLOSED) {
    try {
      if (ctx.user.email) {
        await emailService.sendFromTemplate({ key: 'ticket_closed', to: ctx.user.email, data: ctx, event: 'ticket_closed', ticket: ticket._id, user: ticket.user, company: ticket.company });
      }
    } catch (err) { /* non-blocking */ }
    const { notifyUser } = require('./notification.service');
    await notifyUser({ userId: ticket.user, company: ticket.company, type: 'status_change', message: `Your ticket ${ticket.number} has been closed`, link: `/ticket/${ticket.number}`, ticket: ticket._id }).catch(() => {});
    await handleTicketClosed(ticket, { actor: actorId, actorId, actorType, actorName });
  }
  if ((prev === Ticket.STATUSES.CLOSED || prev === Ticket.STATUSES.RESOLVED) && status !== Ticket.STATUSES.CLOSED && status !== Ticket.STATUSES.RESOLVED) {
    await handleTicketReopened(ticket);
  }
  return { ticket, prev };
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

/**
 * Auto-close resolved tickets with no customer reply inside the configured
 * waiting window (settings.tickets.autoCloseAfterHours, default 72h).
 * Lifecycle §23: RESOLVED --(no response)--> CLOSED + closure email + CSAT.
 */
const autoCloseResolvedTickets = async () => {
  const summary = { checked: 0, closed: 0, errors: [] };
  try {
    const settings = await SystemSetting.getSettings();
    if (settings.tickets?.autoCloseEnabled === false) return summary;
    const hours = Number(settings.tickets?.autoCloseAfterHours) || 72;
    if (hours <= 0) return summary;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const due = await Ticket.find({
      status: Ticket.STATUSES.RESOLVED,
      resolvedAt: { $ne: null, $lte: cutoff },
    }).limit(100);
    summary.checked = due.length;
    const blockOnTasks = settings.tickets?.blockCloseOnOpenTasks !== false;
    const Task = blockOnTasks ? require('../models/Task') : null;
    for (const ticket of due) {
      try {
        if (Task && (await Task.countDocuments({ ticket: ticket._id, status: 'open' })) > 0) {
          continue; // parent waits for subtasks (§22)
        }
        // Use the same audited state command as interactive closure. This keeps
        // transition validation, durable system evidence, notifications and CSAT
        // behavior consistent instead of silently writing status in the job.
        await applyStatusChange(ticket, Ticket.STATUSES.CLOSED, {
          actorType: 'system',
          actorId: null,
          actorName: 'Auto-close scheduler',
          reason: `No customer reply for ${hours}h after resolution`,
        });
        summary.closed += 1;
      } catch (err) {
        summary.errors.push(err.message);
        logger.error(`Auto-close failed for ${ticket.number}: ${err.message}`);
      }
    }
  } catch (err) {
    summary.errors.push(err.message);
    logger.error(`Auto-close run failed: ${err.message}`);
  }
  return summary;
};

const scheduleAutoCloseCheck = () => {
  setInterval(async () => {
    try {
      const s = await autoCloseResolvedTickets();
      if (s.closed > 0) logger.info(`Auto-close summary: ${JSON.stringify(s)}`);
    } catch (err) {
      // ignore
    }
  }, 30 * 60 * 1000);
};

module.exports = {
  createTicket,
  createFollowUpTicket,
  reopenWindowAllows,
  addThreadEntry,
  addSystemEvent,
  applyStatusChange,
  buildTicketContext,
  findOrCreateUser,
  applyFilters,
  resolveDepartment,
  handleTicketResolved,
  handleTicketClosed,
  handleTicketReopened,
  autoCloseResolvedTickets,
  scheduleAutoCloseCheck,
};
