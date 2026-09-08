const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
  service: { type: String, enum: ['platform_availability', 'api_availability', 'support_response', 'support_resolution', 'incident_communication', 'backup', 'rpo', 'rto', 'email_processing', 'notification_processing', 'api_performance', 'security_incident', 'tenant_provisioning'], required: true },
  priority: { type: String, default: '' },
  metric: { type: String, enum: ['percentage', 'duration_minutes', 'frequency_minutes', 'percentile_duration_ms'], required: true },
  threshold: { type: Number, required: true },
  percentile: { type: Number, default: null },
  comparison: { type: String, enum: ['gte', 'lte'], required: true },
}, { _id: true });

const platformSlaPolicySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'active', 'disabled'], default: 'draft', index: true },
  plans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Plan' }],
  calendar: {
    type: { type: String, enum: ['24/7', 'business_hours'], default: '24/7' },
    timezone: { type: String, default: 'UTC' },
    days: { type: [Number], default: [1, 2, 3, 4, 5] },
    start: { type: String, default: '09:00' },
    end: { type: String, default: '17:00' },
    holidays: { type: [Date], default: [] },
  },
  targets: { type: [targetSchema], default: [] },
  escalationRules: [{
    service: String, priority: String, warningAtPct: { type: Number, default: 80 }, breachAfterMinutes: Number,
    actions: [{ type: { type: String, enum: ['notify_owner', 'notify_operations', 'email', 'sms', 'push', 'webhook', 'create_incident', 'page_on_call'] }, target: String }],
  }],
  breachActions: [{ type: { type: String }, target: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', required: true },
}, { timestamps: true });

module.exports = mongoose.model('PlatformSlaPolicy', platformSlaPolicySchema);
