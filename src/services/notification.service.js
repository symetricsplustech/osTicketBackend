const Notification = require('../models/Notification');
const Agent = require('../models/Agent');
const SystemSetting = require('../models/SystemSetting');
const { getIO } = require('../config/socket');

const EVENT_TO_SETTING = {
  new_ticket: 'notifyNewTicket',
  transfer: 'notifyTransfer',
  reply: 'notifyMessage',
  new_message: 'notifyMessage',
  assignment: 'notifyAssignment',
  overdue: 'notifyOverdue',
  escalation: 'notifyEscalation',
  status_change: 'notifyClosed',
  closed: 'notifyClosed',
};

let alertCache = null;
let alertCacheAt = 0;

const isAlertEnabled = async (type) => {
  const key = EVENT_TO_SETTING[type];
  if (!key) return true;
  if (!alertCache || Date.now() - alertCacheAt > 30000) {
    try {
      const settings = await SystemSetting.getSettings();
      alertCache = settings.alerts || {};
    } catch (err) {
      alertCache = {};
    }
    alertCacheAt = Date.now();
  }
  return alertCache[key] !== false;
};

const notifyAgent = async ({ agentId, type, message, link, ticket, company }) => {
  if (!agentId) return;
  if (!(await isAlertEnabled(type))) return;
  try {
    const pref = ((await Agent.findById(agentId).select('notificationPrefs email company').lean()) || {});
    const mode = (pref.notificationPrefs || {})[type] || (pref.notificationPrefs || {})['*'] || 'both';
    if (mode === 'off') return;
    await Notification.create({
      recipientType: 'agent',
      recipient: agentId,
      company: company || null,
      type,
      message,
      link,
      ticket,
    });
    const io = getIO();
    if (io) io.to(`agent:${agentId}`).emit('notification', { type, message, link, ticket });
    if (mode === 'email' || mode === 'both') {
      const emailService = require('./email.service');
      emailService.sendFromTemplate({
        key: 'notification',
        to: pref.email,
        data: { message, link, type, agent: { name: pref.name || '' }, ticketNumber: ticket && typeof ticket === 'object' && ticket.number ? ticket.number : '' },
        event: 'notification',
        ticket: ticket && typeof ticket === 'object' ? ticket._id || null : null,
        company,
      }).catch(() => {});
    }
  } catch (err) {
    // swallow notification errors
  }
};

const notifyUser = async ({ userId, type, message, link, ticket, company }) => {
  if (!userId) return;
  try {
    await Notification.create({
      recipientType: 'user',
      recipient: userId,
      company: company || null,
      type,
      message,
      link,
      ticket,
    });
    const io = getIO();
    if (io) io.to(`user:${userId}`).emit('notification', { type, message, link, ticket });
  } catch (err) {
    // swallow notification errors
  }
};

const notifySuperAdmin = async ({ superAdminId, type, message, link, company, ticket }) => {
  if (!superAdminId) return;
  try {
    await Notification.create({
      recipientType: 'superadmin',
      recipient: superAdminId,
      company: company || null,
      type,
      message,
      link,
      ticket: ticket || null,
    });
    const io = getIO();
    if (io) io.to(`superadmin:${superAdminId}`).emit('notification', { type, message, link, company, ticket });
  } catch (err) {
    // swallow notification errors
  }
};

const notifyAdminRoom = async ({ type, message, link, ticket, company }) => {
  try {
    const agents = await Agent.find({ isActive: true, ...(company ? { company } : {}) }).populate('role', 'isAdmin');
    const io = getIO();
    for (const a of agents) {
      if (a.isAdmin || a.role?.isAdmin) {
        await Notification.create({
          recipientType: 'agent',
          recipient: a._id,
          company: company || null,
          type,
          message,
          link,
          ticket,
        });
        if (io) io.to(`agent:${a._id}`).emit('notification', { type, message, link, ticket });
      }
    }
    if (io) io.to('admin:room').emit('notification', { type, message, link, ticket });
  } catch (err) {
    // swallow
  }
};

module.exports = { notifyAgent, notifyUser, notifyAdminRoom, notifySuperAdmin };
