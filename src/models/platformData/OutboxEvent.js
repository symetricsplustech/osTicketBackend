const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const outboxEventSchema = new mongoose.Schema({
  eventType: String, payload: mongoose.Schema.Types.Mixed,
  published: { type: Boolean, default: false }, attempts: { type: Number, default: 0 },
  lastError: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.OutboxEvent || mongoose.model('OutboxEvent', outboxEventSchema);
