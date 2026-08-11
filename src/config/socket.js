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
  });
  return io;
};

const getIO = () => io;

module.exports = { setIO, getIO };
