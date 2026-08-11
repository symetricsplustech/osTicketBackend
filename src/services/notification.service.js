const Notification = require('../models/Notification');
const Agent = require('../models/Agent');
const { getIO } = require('../config/socket');

const notifyAgent = async ({ agentId, type, message, link, ticket, company }) => {
  if (!agentId) return;
  try {
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
