const mongoose = require('mongoose');
const remediationActionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  targetType: { type: String, enum: ['alert', 'ci', 'host'], default: 'alert' },
  commandTemplate: String,
  approvalRequired: { type: Boolean, default: true },
  rollbackCommand: String,
  runs: [{ targetRef: String, status: { type: String, enum: ['pending_approval', 'approved', 'executed', 'failed', 'rolled_back'], default: 'pending_approval' }, output: String, approvedBy: mongoose.Schema.Types.ObjectId, executedBy: mongoose.Schema.Types.ObjectId, at: Date }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.RemediationAction || mongoose.model('RemediationAction', remediationActionSchema);
