const { Schema, model } = require('mongoose');
const CommunicationTemplateSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  type: { type: String, enum: ['internal', 'external', 'stakeholder', 'executive', 'resolution', 'escalation'], required: true, index: true },
  subject: { type: String, required: true, trim: true },
  body: { type: String, required: true },
  channel: { type: String, enum: ['email', 'sms', 'slack', 'teams', 'webhook', 'push', 'voice'], default: 'email' },
  variables: [{ name: { type: String, required: true }, description: { type: String }, required: { type: Boolean, default: false } }],
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
CommunicationTemplateSchema.index({ tenantId: 1, type: 1, isActive: 1 });
module.exports = model('CommunicationTemplate', CommunicationTemplateSchema);
