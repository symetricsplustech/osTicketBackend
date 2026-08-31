const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const webhookDeliveryLogSchema = new mongoose.Schema({
  webhook: { type: mongoose.Schema.Types.ObjectId, ref: 'Webhook', index: true },
  eventType: String, payload: mongoose.Schema.Types.Mixed,
  signature: String, responseStatus: Number, attempt: { type: Number, default: 1 },
  deadLettered: { type: Boolean, default: false },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.WebhookDeliveryLog || mongoose.model('WebhookDeliveryLog', webhookDeliveryLogSchema);
