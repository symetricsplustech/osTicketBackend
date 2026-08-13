const fs = require('fs');
const path = require('path');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const config = require('../config/config');
const logger = require('../utils/logger');
const { uploadsDir } = require('../config/multer');
const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const HelpTopic = require('../models/HelpTopic');
const Agent = require('../models/Agent');
const EmailLog = require('../models/EmailLog');
const SystemSetting = require('../models/SystemSetting');
const ticketService = require('./ticket.service');
const emailService = require('./email.service');
const { notifyAgent } = require('./notification.service');

const TICKET_REF_PATTERN = /\[#([A-Z0-9]{8,12})\]/i;
const TICKET_REF_BODY_PATTERN = /#([A-Z0-9]{8,12})\b/i;
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

const resolveInboundCompany = async () => {
  if (process.env.EMAIL_DEFAULT_COMPANY) return process.env.EMAIL_DEFAULT_COMPANY || null;
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

const markProcessed = async ({ messageId, subject, from, action, ticket }) => {
  try {
    await EmailLog.create({
      to: from || '',
      from: config.email.from,
      subject: subject || '',
      event: 'inbound_processed',
      status: 'processed',
      meta: { messageId, inboundAction: action },
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

const handleNewTicket = async ({ senderName, senderEmail, subject, text, attachments, companyId }) => {
  const sender = await ticketService.findOrCreateUser({ name: senderName, email: senderEmail, company: companyId });
  const helpTopic = await findHelpTopic(companyId);
  const ticket = await ticketService.createTicket({
    user: sender,
    orgOwner: sender._id,
    createdBy: sender._id,
    subject,
    details: text,
    topicId: helpTopic?._id || null,
    priority: 'Normal',
    source: 'email',
    attachments,
  });
  return ticket;
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

const processParsedEmail = async ({ messageId, senderName, senderEmail, subject, text, attachments, companyId }) => {
  if (!senderEmail) return { action: 'skipped', reason: 'no sender' };
  if (await isProcessed(messageId)) return { action: 'skipped', reason: 'duplicate' };
  if (await isSystemSent(messageId)) return { action: 'skipped', reason: 'system generated' };
  if (await isBannedSender(senderEmail)) return { action: 'skipped', reason: 'banned sender' };
  if (BOUNCE_SENDERS.has(String(senderEmail).toLowerCase()) || BOUNCE_SUBJECT_PATTERN.test(subject || '')) {
    return { action: 'skipped', reason: 'bounce notification' };
  }

  const savedAttachments = await saveEmailAttachments(attachments);
  const number = extractTicketNumber(subject, text);
  let ticket = null;

  if (number) {
    ticket = await Ticket.findOne({ number, status: { $ne: Ticket.STATUSES.DELETED }, ...(companyId ? { company: companyId } : {}) });
  }
  if (ticket) {
    const sender = await ticketService.findOrCreateUser({ name: senderName, email: senderEmail, company: companyId });
    await handleReply({ sender, ticket, text, attachments: savedAttachments });
    await markProcessed({ messageId, subject, from: senderEmail, action: 'reply', ticket: ticket._id });
    return { action: 'reply', ticketNumber: ticket.number };
  }

  const created = await handleNewTicket({ senderName, senderEmail, subject, text, attachments: savedAttachments, companyId });
  await markProcessed({ messageId, subject, from: senderEmail, action: 'new_ticket', ticket: created._id });
  return { action: 'new_ticket', ticketNumber: created.number };
};

const parseMessage = async (message) => {
  const raw = message.source || message.raw;
  if (!raw) return null;
  const parsed = await simpleParser(raw);
  const from = parsed.from?.value?.[0] || {};
  return {
    messageId: parsed.messageId || message.envelope?.messageId || null,
    senderName: from.name || parsed.from?.text?.split('<')[0]?.trim() || 'Email Sender',
    senderEmail: (from.address || '').toLowerCase(),
    subject: parsed.subject || '(No Subject)',
    text: (parsed.text || '').slice(0, MAX_TEXT_LENGTH),
    attachments: parsed.attachments || [],
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
      const companyId = await resolveInboundCompany();
      const search = await client.search({ seen: false, since }, { uid: true });
      for (const uid of search) {
        try {
          const message = await client.fetchOne(String(uid), { envelope: true, source: true }, { uid: true });
          const parsed = await parseMessage(message);
          if (!parsed) {
            summary.skipped += 1;
            continue;
          }
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
