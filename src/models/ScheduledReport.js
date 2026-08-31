const mongoose = require('mongoose');
const scheduledReportSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['tickets', 'crm', 'analytics', 'hr', 'projects', 'custom'], required: true },
  query: mongoose.Schema.Types.Mixed,
  columns: [String],
  format: { type: String, enum: ['csv', 'excel', 'pdf'], default: 'csv' },
  schedule: {
    frequency: { type: String, enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly'], required: true },
    dayOfWeek: Number,
    dayOfMonth: Number,
    time: { type: String, default: '09:00' },
    timezone: { type: String, default: 'UTC' },
  },
  recipients: [{ email: String, userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }],
  lastRunAt: Date,
  nextRunAt: Date,
  status: { type: String, enum: ['active', 'paused', 'error'], default: 'active' },
  lastError: String,
  runCount: { type: Number, default: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });

scheduledReportSchema.index({ status: 1, nextRunAt: 1 });

const ScheduledReport = mongoose.model('ScheduledReport', scheduledReportSchema);

module.exports = { ScheduledReport };

