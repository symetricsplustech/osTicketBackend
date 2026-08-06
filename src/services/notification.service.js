const Notification = require('../models/Notification');
const Agent = require('../models/Agent');
const { getIO } = require('../config/socket');

const notifyAgent = async ({ agentId, type, message, link, ticket }) => {
  if (!agentId) return;
  try {
    await Notification.create({
      recipientType: 'agent',
      recipient: agentId,
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

const notifyUser = async ({ userId, type, message, link, ticket }) => {
  if (!userId) return;
  try {
    await Notification.create({
      recipientType: 'user',
      recipient: userId,
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

const notifyAdminRoom = async ({ type, message, link, ticket }) => {
  try {
    const agents = await Agent.find({ isActive: true }).populate('role', 'isAdmin');
    const io = getIO();
    for (const a of agents) {
      if (a.isAdmin || a.role?.isAdmin) {
        await Notification.create({
          recipientType: 'agent',
          recipient: a._id,
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

module.exports = { notifyAgent, notifyUser, notifyAdminRoom };
