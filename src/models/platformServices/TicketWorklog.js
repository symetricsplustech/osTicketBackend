const mongoose = require('mongoose');
const ticketWorklogSchema = new mongoose.Schema({
  ticketNumber: { type: String, required: true, index: true },
  agent: mongoose.Schema.Types.ObjectId,
  minutes: { type: Number, required: true },
  billable: { type: Boolean, default: false },
  note: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.TicketWorklog || mongoose.model('TicketWorklog', ticketWorklogSchema);
