const { Schema, model } = require('mongoose');
const EscalationLevelSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  policyId: { type: Schema.Types.ObjectId, ref: 'EscalationPolicy', required: true, index: true },
  level: { type: Number, required: true, min: 1 },
  name: { type: String, required: true, trim: true },
  delayMinutes: { type: Number, required: true, min: 0 },
  targets: [{
    type: { type: String, enum: ['user', 'team', 'group', 'email', 'sms', 'webhook', 'slack', 'voice'], required: true },
    value: { type: Schema.Types.Mixed, required: true },
    order: { type: Number, default: 0 },
  }],
  notifyUntilAcknowledged: { type: Boolean, default: false },
  acknowledgementTimeoutMinutes: { type: Number, default: 0 },
  autoEscalateIfNoAck: { type: Boolean, default: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
EscalationLevelSchema.index({ tenantId: 1, policyId: 1, level: 1 });
module.exports = model('EscalationLevel', EscalationLevelSchema);
