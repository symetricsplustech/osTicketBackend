const Ticket = require("../models/helpdesk/tickets/Ticket");
const { getIO } = require("../config/socket");

async function broadcastSnapshot({ company } = {}) {
  const query = company ? { company } : {};
  const [open, overdue] = await Promise.all([
    Ticket.countDocuments({
      ...query,
      status: { $nin: ["resolved", "closed", "archived", "deleted"] },
    }),
    Ticket.countDocuments({ ...query, isOverdue: true }),
  ]);
  const snapshot = { open, overdue, at: new Date().toISOString() };
  const io = getIO();
  if (io)
    io.to(company ? `company:${company}` : "admin:room").emit(
      "realtime:snapshot",
      snapshot,
    );
  return snapshot;
}

module.exports = { broadcastSnapshot };
