const { getIO } = require("../config/socket");

function emitEvent(tenantId, event, payload = {}) {
  const io = getIO();
  if (!io) return;
  const data = { ...payload, tenantId };
  io.to(`company:${tenantId}`).emit(event, data);
  io.to("admin:room").emit(event, data);
}

module.exports = { emitEvent };
