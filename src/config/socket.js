let io = null;

const setIO = (server) => {
  if (io) return io;
  const { Server } = require('socket.io');
  const config = require('./config');
  io = new Server(server, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
  });
  io.on('connection', (socket) => {
    socket.on('agent:join', (agentId) => {
      if (agentId) socket.join(`agent:${agentId}`);
    });
    socket.on('agent:joinAdmin', () => {
      socket.join('admin:room');
    });
    socket.on('user:join', (userId) => {
      if (userId) socket.join(`user:${userId}`);
    });
    socket.on('superadmin:join', (id) => {
      if (id) socket.join(`superadmin:${id}`);
    });
    // ---- Enterprise: omnichannel chat rooms + presence ----
    socket.on('chat:join', (conversationId) => {
      if (conversationId) socket.join(`conv:${conversationId}`);
    });
    socket.on('chat:leave', (conversationId) => {
      if (conversationId) socket.leave(`conv:${conversationId}`);
    });
    socket.on('status:join', (slug) => {
      if (slug) socket.join(`status:${slug}`);
    });
    socket.on('agent:presence', async (data) => {
      const { agentId, presence } = data || {};
      if (!agentId || !presence) return;
      try {
        const Agent = require('../models/Agent');
        await Agent.updateOne({ _id: agentId }, { $set: { presence, presenceChangedAt: new Date() } });
        io.to('admin:room').emit('agent:presence', { agentId, presence });
        const { emit } = require('../services/events');
        emit('agent.status_changed', { company: null, actor: agentId, agentId, presence });
        const realtime = require('../services/realtime.service');
        realtime.broadcastSnapshot({}).catch(() => {});
      } catch (err) {
        // ignore
      }
    });
  });
  return io;
};

const getIO = () => io;

module.exports = { setIO, getIO };
