const mongoose = require('mongoose');
const workflowExecutionLogSchema = new mongoose.Schema({
  workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
  trigger: { type: String, enum: ['ticket_created', 'ticket_updated', 'ticket_closed', 'time_based', 'manual', 'alert_created', 'asset_changed'], required: true },
  triggerData: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['running', 'completed', 'failed', 'cancelled', 'retrying'], default: 'running' },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  duration: Number,
  steps: [{
    stepNumber: Number,
    name: String,
    action: String,
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'skipped'], default: 'pending' },
    input: mongoose.Schema.Types.Mixed,
    output: mongoose.Schema.Types.Mixed,
    error: String,
    startedAt: Date,
    completedAt: Date,
    retryCount: { type: Number, default: 0 },
  }],
  error: String,
  retryOf: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowExecutionLog' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
workflowExecutionLogSchema.index({ workflow: 1, startedAt: -1 });
workflowExecutionLogSchema.index({ status: 1 });
workflowExecutionLogSchema.index({ trigger: 1 });
module.exports = mongoose.models.WorkflowExecutionLog || mongoose.model('WorkflowExecutionLog', workflowExecutionLogSchema);
