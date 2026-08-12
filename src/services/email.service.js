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

let settingsTransporter = null;
let settingsFrom = '';
let lastSettingsCheck = 0;

const getSettingsTransport = async () => {
  if (Date.now() - lastSettingsCheck < 30000) return { transporter: settingsTransporter, from: settingsFrom };
  lastSettingsCheck = Date.now();
  try {
    const settings = await SystemSetting.getSettings();
    const email = settings.email || {};
    if (email.smtpHost) {
      settingsFrom = `${email.fromName ? `${email.fromName} ` : ''}<${email.fromEmail || email.smtpUser || ''}>`.trim();
      settingsTransporter = nodemailer.createTransport({
        host: email.smtpHost,
        port: Number(email.smtpPort) || 587,
        secure: email.smtpSecure !== false,
        auth: email.smtpUser ? { user: email.smtpUser, pass: email.smtpPass || '' } : undefined,
      });
    } else {
      settingsTransporter = null;
      settingsFrom = '';
    }
  } catch (err) {
    settingsTransporter = null;
    settingsFrom = '';
  }
  return { transporter: settingsTransporter, from: settingsFrom };
};

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
  const { transporter: st, from: stFrom } = await getSettingsTransport();
  const activeTransporter = st || transporter;
  const from = stFrom || config.email.from;
  const enabled = st ? true : config.email.enabled;
  if (!enabled) {
    logger.info(`[EMAIL ${event}] To: ${to} | Subject: ${subject}`);
    logger.info(`[EMAIL BODY]\n${body}`);
    await logEmail({ to, subject, body, event, ticket, user, status: 'queued', meta: { dev: true }, company });
    return { queued: true, dev: true };
  }
  try {
    const info = await activeTransporter.sendMail({
      from,
      to,
      subject,
      html: htmlBody,
    });
    await logEmail({ to, subject, body, event, ticket, user, status: 'sent', meta: { ...meta, messageId: info?.messageId || '' }, company });
    return { queued: false, messageId: info?.messageId || '' };
  } catch (err) {
    logger.error(`Email send failed: ${err.message}`);
    await logEmail({ to, subject, body, event, ticket, user, status: 'failed', error: err.message, meta, company });
    return { queued: false, error: err.message };
  }
};

const loadTemplate = async (key, companyId) => {
  if (companyId) {
    const companyTemplate = await EmailTemplate.findOne({ key, company: companyId });
    if (companyTemplate) return companyTemplate.isActive ? companyTemplate : null;
  }
  const globalTemplate = await EmailTemplate.findOne({ key, company: null });
  return globalTemplate && globalTemplate.isActive ? globalTemplate : null;
};

const sendFromTemplate = async ({ key, to, data, event, ticket, user, meta, company }) => {
  const template = await loadTemplate(key, company);
  if (!template) {
    const disabled = await EmailTemplate.exists({ key, company });
    if (disabled) {
      logger.info(`Email template disabled, skipping: ${key}`);
    } else {
      logger.warn(`Email template not found: ${key}`);
    }
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
