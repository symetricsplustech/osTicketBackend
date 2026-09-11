const { Schema, model } = require('mongoose');
const CommunicationTaskSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  majorIncidentId: { type: Schema.Types.ObjectId, ref: 'MajorIncident', required: true, index: true },
  templateId: { type: Schema.Types.ObjectId, ref: 'CommunicationTemplate' },
  type: { type: String, enum: ['internal', 'external', 'stakeholder', 'executive', 'resolution', 'escalation'], required: true },
  audience: { type: String, enum: ['internal', 'external', 'customer', 'stakeholder', 'executive', 'vendor', 'media', 'all'], required: true },
  channel: { type: String, enum: ['email', 'sms', 'slack', 'teams', 'webhook', 'push', 'voice', 'bridge'], default: 'email' },
  subject: { type: String, trim: true, default: '' },
  body: { type: String, required: true },
  status: { type: String, enum: ['pending', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'], default: 'pending', index: true },
  scheduledAt: { type: Date },
  sentAt: { type: Date },
  failedAt: { type: Date },
  errorMessage: { type: String, trim: true, default: '' },
  recipientCount: { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
  openedCount: { type: Number, default: 0 },
  clickedCount: { type: Number, default: 0 },
  variables: { type: Schema.Types.Mixed, default: {} },
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
CommunicationTaskSchema.index({ tenantId: 1, majorIncidentId: 1, status: 1 });
module.exports = model('CommunicationTask', CommunicationTaskSchema);
