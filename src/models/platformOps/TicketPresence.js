const mongoose = require('mongoose');
const ticketPresenceSchema = new mongoose.Schema({
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
  userName: String,
  lastSeen: { type: Date, default: Date.now },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
ticketPresenceSchema.index({ ticket: 1, user: 1 }, { unique: true });
module.exports = mongoose.models.TicketPresence || mongoose.model('TicketPresence', ticketPresenceSchema);
