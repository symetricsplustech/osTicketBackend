const nodemailer = require('nodemailer');
const config = require('../config/config');
const EmailTemplate = require('../models/EmailTemplate');
const EmailLog = require('../models/EmailLog');
const SystemSetting = require('../models/SystemSetting');
const renderTemplate = require('../utils/renderTemplate');
const logger = require('../utils/logger');

let transporter = null;
if (config.email.enabled) {
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: { user: config.email.user, pass: config.email.password },
  });
}

const logEmail = async ({ to, subject, body, event, ticket, user, status, error, meta, company }) => {
  try {
    await EmailLog.create({
      to,
      from: config.email.from,
      subject,
      body,
      event,
      company: company || null,
      ticket,
      user,
      status,
      error: error || '',
      meta: meta || {},
    });
  } catch (err) {
    logger.error(`Failed to log email: ${err.message}`);
  }
};

const sendMail = async ({ to, subject, body, html, event = 'general', ticket, user, meta, company }) => {
  const htmlBody = html || body.replace(/\n/g, '<br/>');
  if (!config.email.enabled) {
    logger.info(`[EMAIL ${event}] To: ${to} | Subject: ${subject}`);
    logger.info(`[EMAIL BODY]\n${body}`);
    await logEmail({ to, subject, body, event, ticket, user, status: 'queued', meta: { dev: true }, company });
    return { queued: true, dev: true };
  }
  try {
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html: htmlBody,
    });
    await logEmail({ to, subject, body, event, ticket, user, status: 'sent', meta, company });
    return { queued: false };
  } catch (err) {
    logger.error(`Email send failed: ${err.message}`);
    await logEmail({ to, subject, body, event, ticket, user, status: 'failed', error: err.message, meta, company });
    return { queued: false, error: err.message };
  }
};

const loadTemplate = async (key, companyId) => {
  if (companyId) return EmailTemplate.findOne({ key, company: companyId });
  return EmailTemplate.findOne({ key, company: null });
};

const sendFromTemplate = async ({ key, to, data, event, ticket, user, meta, company }) => {
  const template = await loadTemplate(key, company);
  if (!template) {
    logger.warn(`Email template not found: ${key}`);
    return null;
  }
  const subject = renderTemplate(template.subject, data);
  const body = renderTemplate(template.body, data);
  return sendMail({ to, subject, body, event, ticket, user, meta: { templateKey: key, ...meta }, company });
};

const getCompanyContext = async (companyId) => {
  const settings = await SystemSetting.getSettings();
  const c = settings.company || {};
  return {
    company: {
      name: c.name || 'My Support Center',
      email: c.email || '',
      phone: c.phone || '',
      url: c.url || config.urls.client,
    },
  };
};

const sendRaw = async (mail) => sendMail(mail);

module.exports = { sendMail, sendFromTemplate, sendRaw, logEmail, getCompanyContext };
