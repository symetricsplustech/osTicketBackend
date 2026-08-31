const mongoose = require('mongoose');
const inboundMessageSchema = new mongoose.Schema({
  channel: { type: String, enum: ['whatsapp', 'facebook', 'instagram', 'sms'], required: true },
  from: String, text: String,
  customerMatched: Boolean, ticketCreated: Boolean, ticketNumber: String,
  receivedAt: { type: Date, default: Date.now },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.InboundMessage || mongoose.model('InboundMessage', inboundMessageSchema);
