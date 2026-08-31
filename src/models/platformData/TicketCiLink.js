const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const ticketCiLinkSchema = new mongoose.Schema({
  ticketNumber: { type: String, index: true },
  ci: { type: mongoose.Schema.Types.ObjectId, ref: 'CI' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.TicketCiLink || mongoose.model('TicketCiLink', ticketCiLinkSchema);
