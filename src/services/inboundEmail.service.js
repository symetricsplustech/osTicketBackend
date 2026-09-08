const fs = require('fs');
const path = require('path');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const config = require('../config/config');
const logger = require('../utils/logger');
const { uploadsDir } = require('../config/multer');
const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Department = require('../models/Department');
const HelpTopic = require('../models/HelpTopic');
const Agent = require('../models/Agent');
const EmailLog = require('../models/EmailLog');
const SystemSetting = require('../models/SystemSetting');
const ticketService = require('./ticket.service');
const emailService = require('./email.service');
const { notifyAgent } = require('./notification.service');

const TICKET_REF_PATTERN = /\[#(TKT-\d{4}-\d+|[A-Z0-9]{8,12})\]/i;
const TICKET_REF_BODY_PATTERN = /#(TKT-\d{4}-\d+|[A-Z0-9]{8,12})\b/i;
const MAX_TEXT_LENGTH = 100 * 1024;
const BOUNCE_SENDERS = new Set(['mailer-daemon@googlemail.com', 'postmaster@googlemail.com', 'mailer-daemon@gmail.com']);
const BOUNCE_SUBJECT_PATTERN = /delivery (status )?notification/i;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', 'application/json',
]);

const extractTicketNumber = (subject = '', text = '') => {
  const subjectMatch = subject.match(TICKET_REF_PATTERN);
  if (subjectMatch) return subjectMatch[1].toUpperCase();
  const bodyMatch = text.slice(0, 500).match(TICKET_REF_BODY_PATTERN);
  return bodyMatch ? bodyMatch[1].toUpperCase() : null;
};

const safeFilename = (name) => (name || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');

const normalizeAddr = (a) => String(a || '').toLowerCase().trim();

// Strip < > so stored Message-IDs match regardless of bracket formatting.
const normalizeMsgId = (id) => String(id || '').trim().replace(/^<+|>+$/g, '');

/**
 * Per-organisation inbound routing.
 * Each hired organisation (Company) has its own support inbox
 * (`supportEmail`, fallback `email`). Customers mail THAT address;
 * we map To/Cc -> Company so the ticket lands in the right tenant
 * without the customer logging in.
 *
 * Order: EMAIL_DEFAULT_COMPANY override -> exact inbox match
 * (supportEmail/email) -> domain match -> first active (legacy fallback).
 */
const resolveInboundCompany = async (opts) => {
  const toAddresses = (opts && opts.toAddresses) || [];
  if (process.env.EMAIL_DEFAULT_COMPANY) return process.env.EMAIL_DEFAULT_COMPANY || null;
  const to = (toAddresses || []).map(normalizeAddr).filter(Boolean);
  if (to.length) {
    // 1. Exact inbox match (supportEmail first, then legacy email).
    const exact = await Company.findOne({
      status: { $in: ['active', 'trial'] },
      $or: [{ supportEmail: { $in: to } }, { email: { $in: to } }],
    }).select('_id');
    if (exact) return exact._id;
    // 2. Domain match: mailed to anything@hired-org-domain.
    const domains = [...new Set(to.map((a) => a.split('@')[1]).filter(Boolean))];
    if (domains.length) {
      const byDomain = await Company.findOne({
        status: { $in: ['active', 'trial'] },
        domain: { $in: domains },
      }).select('_id');
      if (byDomain) return byDomain._id;
    }
  }
  const company = await Company.findOne({ status: 'active' }).sort({ createdAt: 1 });
  return company ? company._id : null;
};

const saveEmailAttachments = async (attachments = []) => {
  try {
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    logger.error(`Failed to create uploads dir: ${err.message}`);
  }
  const saved = [];
  for (const att of attachments) {
    if (!ALLOWED_ATTACHMENT_TYPES.has(att.contentType)) continue;
    if (!att.content || att.content.length > config.maxFileSize) continue;
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeFilename(att.filename)}`;
    const filePath = path.join(uploadsDir, filename);
    try {
      fs.writeFileSync(filePath, att.content);
      saved.push({ filename: att.filename || 'attachment', path: filename, size: att.content.length, mimetype: att.contentType });
    } catch (err) {
      logger.error(`Failed to save email attachment: ${err.message}`);
    }
  }
  return saved;
};

const isBannedSender = async (email) => {
  const settings = await SystemSetting.getSettings();
  const banList = (settings.emails?.banList || []).map((b) => String(b).toLowerCase());
  return banList.includes(email.toLowerCase());
};

const findHelpTopic = async (companyId) => {
  const base = { status: 'active', isPublic: true };
  if (companyId) base.$or = [{ company: companyId }, { company: null }];
  const emailTopic = await HelpTopic.findOne({ ...base, topic: /email/i });
  if (emailTopic) return emailTopic;
  const generalTopic = await HelpTopic.findOne({ ...base, topic: 'General Inquiry' });
  if (generalTopic) return generalTopic;
  return HelpTopic.findOne(base);
};

const isProcessed = async (messageId) => {
  if (!messageId) return false;
  return EmailLog.exists({ event: 'inbound_processed', 'meta.messageId': messageId });
};

const isSystemSent = async (messageId) => {
  if (!messageId) return false;
  return EmailLog.exists({ event: { $ne: 'inbound_processed' }, 'meta.messageId': messageId });
};

const markProcessed = async ({ messageId, subject, from, action, ticket, matchedVia }) => {
  try {
    await EmailLog.create({
      to: from || '',
      from: config.email.from,
      subject: subject || '',
      event: 'inbound_processed',
      status: 'processed',
      meta: { messageId, inboundAction: action, ...(matchedVia ? { matchedVia } : {}) },
      ticket: ticket || null,
    });
  } catch (err) {
    logger.error(`Failed to mark inbound email processed: ${err.message}`);
  }
};

const notifyAgentsForReply = async (ticket, sender) => {
  const ctx = await ticketService.buildTicketContext(ticket);
  const agent = ticket.agent ? await Agent.findById(ticket.agent) : null;
  if (agent && agent.isActive) {
    await notifyAgent({
      agentId: agent._id,
      company: ticket.company,
      type: 'reply',
      message: `New email reply on ticket ${ticket.number}`,
      link: `/tickets/${ticket.number}`,
      ticket: ticket._id,
    });
    try {
      await emailService.sendFromTemplate({
        key: 'new_reply_alert',
        to: agent.email,
        data: { ...ctx, recipient: { name: agent.name } },
        event: 'new_reply_alert',
        ticket: ticket._id,
        user: sender._id,
        company: ticket.company,
      });
    } catch (err) {
      logger.error(`Email reply alert failed: ${err.message}`);
    }
  }
  const deptAgents = await Agent.find({ 'departments.department': ticket.dept, isActive: true, ...(ticket.company ? { company: ticket.company } : {}) });
  for (const a of deptAgents) {
    if (!agent || String(a._id) !== String(agent._id)) {
      await notifyAgent({
        agentId: a._id,
        company: ticket.company,
        type: 'reply',
        message: `New email reply on ticket ${ticket.number}`,
        link: `/tickets/${ticket.number}`,
        ticket: ticket._id,
      });
    }
  }
};

const handleNewTicket = async ({ senderName, senderEmail, subject, text, attachments, companyId, toAddresses = [] }) => {
  // Reuse the existing account by email (any tenant) so portal history stays
  // linked when the customer later logs in. User.email is globally unique,
  // so creating a second record for the same address would throw E11000.
  const existing = await User.findOne({ email: normalizeAddr(senderEmail) });
  const effectiveCompanyId = existing?.company || companyId;
  const sender = existing || (await ticketService.findOrCreateUser({ name: senderName, email: senderEmail, company: companyId }));
  // Backfill tenant for email-created accounts that had none (else portal
  // auth denies tenant-less users). Never move an already-tenanted account.
  if (!sender.company && companyId) {
    sender.company = companyId;
    await sender.save().catch(() => {});
  }
  // Per-mailbox routing: To/Cc matching a department inbox pins the ticket
  // to that department (and its SLA); otherwise topic/filters decide.
  let deptId = null;
  try {
    deptId = await findDeptByInbox(effectiveCompanyId || companyId, toAddresses);
  } catch (err) {
    logger.error(`Dept inbox lookup failed: ${err.message}`);
  }
  const helpTopic = await findHelpTopic(effectiveCompanyId || companyId);
  const ticket = await ticketService.createTicket({
    user: sender,
    orgOwner: sender._id,
    createdBy: sender._id,
    subject,
    details: text,
    topicId: helpTopic?._id || null,
    deptId,
    priority: 'Normal',
    source: 'email',
    attachments,
    toAddresses,
  });
  return ticket;
};

/**
 * Per-mailbox routing table: a department whose `email` matches a To/Cc
 * address owns the message (e.g. billing@ -> Billing dept + Billing SLA,
 * since createTicket derives SLA from the department).
 */
const findDeptByInbox = async (companyId, toAddresses = []) => {
  const to = new Set((toAddresses || []).map(normalizeAddr).filter(Boolean));
  if (!companyId || !to.size) return null;
  const depts = await Department.find({
    status: 'active',
    $or: [{ company: companyId }, { company: null }],
    email: { $ne: '' },
  }).select('_id email').lean();
  const hit = depts.find((d) => to.has(normalizeAddr(d.email)));
  return hit ? hit._id : null;
};

/**
 * Step 1 of reply matching: resolve the ticket from In-Reply-To / References
 * headers via the outbound EmailLog (every sent mail logs its Message-ID with
 * the ticket). Prefers our own outbound mails over echoed inbound IDs.
 */
const findTicketByHeaders = async (inReplyTo = [], references = []) => {
  const ids = [...inReplyTo, ...references]
    .map(normalizeMsgId)
    .filter(Boolean)
    .slice(0, 10);
  if (!ids.length) return null;
  const variants = [...new Set(ids.flatMap((id) => [id, `<${id}>`]))];
  const query = { 'meta.messageId': { $in: variants }, ticket: { $ne: null } };
  const outbound = await EmailLog.findOne({ ...query, event: { $ne: 'inbound_processed' } })
    .sort({ createdAt: -1 })
    .select('ticket');
  const log = outbound
    || (await EmailLog.findOne(query).sort({ createdAt: -1 }).select('ticket'));
  if (!log?.ticket) return null;
  return Ticket.findOne({ _id: log.ticket, status: { $ne: Ticket.STATUSES.DELETED } });
};

/**
 * Step 5 of reply matching: only the ticket owner, a collaborator, or an
 * agent of the same company may append to a ticket by email. Anything else
 * falls through to new-ticket creation so unrelated mail never lands on a
 * stranger's ticket.
 */
const isAuthorizedReplySender = async (ticket, senderEmail) => {
  const email = normalizeAddr(senderEmail);
  if (!email) return false;
  const owner = await User.findById(ticket.user).select('email').lean();
  if (owner && normalizeAddr(owner.email) === email) return true;
  if (ticket.collaborators?.length) {
    const collabs = await User.find({ _id: { $in: ticket.collaborators } }).select('email').lean();
    if (collabs.some((c) => normalizeAddr(c.email) === email)) return true;
  }
  if (ticket.company) {
    const agent = await Agent.findOne({ email, company: ticket.company, isActive: true }).select('_id').lean();
    if (agent) return true;
  }
  return false;
};

const handleReply = async ({ sender, ticket, text, attachments }) => {
  await ticketService.addThreadEntry({
    ticket,
    type: 'message',
    posterType: 'user',
    user: sender,
    body: text,
    attachments,
  });
  await notifyAgentsForReply(ticket, sender);
  return ticket;
};

const processParsedEmail = async ({ messageId, inReplyTo = [], references = [], senderName, senderEmail, subject, text, attachments, companyId, toAddresses = [] }) => {
  if (!senderEmail) return { action: 'skipped', reason: 'no sender' };
  if (await isProcessed(messageId)) return { action: 'skipped', reason: 'duplicate' };
  if (await isSystemSent(messageId)) return { action: 'skipped', reason: 'system generated' };
  if (await isBannedSender(senderEmail)) return { action: 'skipped', reason: 'banned sender' };
  if (BOUNCE_SENDERS.has(String(senderEmail).toLowerCase()) || BOUNCE_SUBJECT_PATTERN.test(subject || '')) {
    return { action: 'skipped', reason: 'bounce notification' };
  }

  const savedAttachments = await saveEmailAttachments(attachments);
  // Resolve per-message so each hired organisation's inbox routes to its own
  // tenant even when one IMAP poller serves multiple inboxes/aliases.
  let effectiveCompanyId = companyId;
  if (!effectiveCompanyId) {
    try {
      effectiveCompanyId = await resolveInboundCompany({ toAddresses });
    } catch (err) {
      logger.error(`Inbound company resolution failed: ${err.message}`);
    }
  }
  const number = extractTicketNumber(subject, text);
  let ticket = null;
  let matchedVia = null;

  // 1-2. Headers first (In-Reply-To / References via outbound mail log).
  try {
    ticket = await findTicketByHeaders(inReplyTo, references);
    if (ticket) matchedVia = 'headers';
  } catch (err) {
    logger.error(`Header reply-match failed: ${err.message}`);
  }
  // 3-4. Ticket token in subject/body. Numbers are globally unique: look up
  // without a tenant filter so a reply sticks to its original ticket/company
  // even if the customer mailed a slightly different alias.
  if (!ticket && number) {
    ticket = await Ticket.findOne({ number, status: { $ne: Ticket.STATUSES.DELETED } });
    if (ticket) matchedVia = 'subject';
  }
  if (ticket) {
    // 5. Sender authorization — strangers fall through to new-ticket creation.
    const authorized = await isAuthorizedReplySender(ticket, senderEmail).catch(() => false);
    if (!authorized) {
      logger.warn(`Unauthorized email reply from ${senderEmail} for ticket ${ticket.number}; creating new ticket`);
      ticket = null;
      matchedVia = null;
    }
  }
  if (ticket) {
    const replyCompanyId = ticket.company || effectiveCompanyId;
    const existingSender = await User.findOne({ email: normalizeAddr(senderEmail) });
    const sender = existingSender || (await ticketService.findOrCreateUser({ name: senderName, email: senderEmail, company: replyCompanyId }));
    if (!sender.company && replyCompanyId) {
      sender.company = replyCompanyId;
      await sender.save().catch(() => {});
    }
    // Reply window expired (§40): follow-up ticket linked to the old one.
    if (ticket.status === Ticket.STATUSES.RESOLVED || ticket.status === Ticket.STATUSES.CLOSED) {
      const replySettings = await SystemSetting.getSettings().catch(() => null);
      if (replySettings && !ticketService.reopenWindowAllows(ticket, replySettings)) {
        const created = await ticketService.createFollowUpTicket({
          ticket,
          user: sender,
          body: text,
          attachments: savedAttachments,
          source: 'email',
          actorId: sender._id,
        });
        await markProcessed({ messageId, subject, from: senderEmail, action: 'new_ticket', ticket: created._id, matchedVia: 'window_expired' });
        try {
          await notifyAgentsForReply(created, sender);
        } catch (_) { /* non-blocking */ }
        return { action: 'new_ticket', ticketNumber: created.number, followUp: true, linkedTo: ticket.number };
      }
    }
    await handleReply({ sender, ticket, text, attachments: savedAttachments });
    await markProcessed({ messageId, subject, from: senderEmail, action: 'reply', ticket: ticket._id, matchedVia });
    return { action: 'reply', ticketNumber: ticket.number, matchedVia };
  }

  const created = await handleNewTicket({ senderName, senderEmail, subject, text, attachments: savedAttachments, companyId: effectiveCompanyId, toAddresses });
  await markProcessed({ messageId, subject, from: senderEmail, action: 'new_ticket', ticket: created._id });
  return { action: 'new_ticket', ticketNumber: created.number };
};

const parseMessage = async (message) => {
  const raw = message.source || message.raw;
  if (!raw) return null;
  const parsed = await simpleParser(raw);
  const from = parsed.from?.value?.[0] || {};
  const collect = (v) => {
    if (!v) return [];
    const arr = Array.isArray(v) ? v : [v];
    const out = [];
    for (const item of arr) {
      if (typeof item === 'string') out.push(item);
      else if (item?.address) out.push(item.address);
      else if (Array.isArray(item?.value)) {
        for (const sub of item.value) {
          if (sub?.address) out.push(sub.address);
        }
      }
    }
    return out;
  };
  const toAddresses = [
    ...collect(parsed.to),
    ...collect(parsed.cc),
  ].map((a) => String(a).toLowerCase().trim()).filter(Boolean);
  const asIds = (v) => {
    if (!v) return [];
    const arr = Array.isArray(v) ? v : [v];
    return arr.map((x) => String(x || '').trim()).filter(Boolean);
  };
  return {
    messageId: parsed.messageId || message.envelope?.messageId || null,
    inReplyTo: asIds(parsed.inReplyTo),
    references: asIds(parsed.references),
    senderName: from.name || parsed.from?.text?.split('<')[0]?.trim() || 'Email Sender',
    senderEmail: (from.address || '').toLowerCase(),
    subject: parsed.subject || '(No Subject)',
    text: (parsed.text || '').slice(0, MAX_TEXT_LENGTH),
    attachments: parsed.attachments || [],
    toAddresses: [...new Set(toAddresses)],
  };
};

const pollInbox = async ({ sinceDays } = {}) => {
  const client = new ImapFlow({
    host: config.email.imapHost,
    port: config.email.imapPort,
    secure: config.email.imapSecure,
    auth: { user: config.email.imapUser, pass: config.email.imapPassword },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  const since = new Date(Date.now() - (sinceDays || config.email.imapWindowDays) * 24 * 60 * 60 * 1000);
  const summary = { processed: 0, newTickets: 0, replies: 0, skipped: 0, errors: [] };

  try {
    await client.connect();
    const lock = await client.getMailboxLock(config.email.imapMailbox);
    try {
      const search = await client.search({ seen: false, since }, { uid: true });
      for (const uid of search) {
        try {
          const message = await client.fetchOne(String(uid), { envelope: true, source: true }, { uid: true });
          const parsed = await parseMessage(message);
          if (!parsed) {
            summary.skipped += 1;
            continue;
          }
          // Per-message tenant routing: each hired org's support inbox maps
          // to its own Company even under a single shared IMAP poller.
          const companyId = await resolveInboundCompany({ toAddresses: parsed.toAddresses }).catch(() => null);
          const result = await processParsedEmail({ ...parsed, companyId });
          summary.processed += 1;
          if (result.action === 'new_ticket') summary.newTickets += 1;
          else if (result.action === 'reply') summary.replies += 1;
          else summary.skipped += 1;
          await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        } catch (err) {
          summary.errors.push(err.message);
          logger.error(`Inbound email processing failed for UID ${uid}: ${err.message}`);
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    logger.error(`IMAP poll failed: ${err.message}`);
    summary.errors.push(err.message);
  } finally {
    await client.logout().catch(() => {});
  }

  return summary;
};

const startInboundPoller = () => {
  if (!config.email.imapEnabled) {
    logger.info('Inbound email polling disabled (set EMAIL_IMAP_ENABLED=false to keep off).');
    return;
  }
  logger.info(`Inbound email polling started for ${config.email.imapUser} (${config.email.imapMailbox}) every ${config.email.imapPollInterval / 1000}s`);
  setInterval(() => {
    pollInbox().then((s) => {
      if (s.processed > 0) logger.info(`Inbound poll summary: ${JSON.stringify(s)}`);
    }).catch((err) => logger.error(`Inbound poll crashed: ${err.message}`));
  }, config.email.imapPollInterval);
};

module.exports = {
  pollInbox,
  startInboundPoller,
  parseMessage,
  processParsedEmail,
  extractTicketNumber,
  resolveInboundCompany,
};
