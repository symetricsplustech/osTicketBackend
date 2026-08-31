const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const ticketRelationExtraSchema = new mongoose.Schema({
  ticketNumber: { type: String, index: true }, relatedNumber: String,
  type: { type: String, enum: ['blocked_by', 'caused_by', 'duplicate_of'], default: 'blocked_by' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.TicketRelationExtra || mongoose.model('TicketRelationExtra', ticketRelationExtraSchema);
