const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    type: {
      type: String,
      enum: ['individual', 'group', 'sequential', 'parallel'],
      default: 'individual',
    },
    state: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'skipped'],
      default: 'pending',
      index: true,
    },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    approvalGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    approvers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    approvalsReceived: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    requiredApprovals: { type: Number, default: 1 },
    order: { type: Number, default: 0 },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, default: '' },
    dueAt: { type: Date, default: null },
    escalated: { type: Boolean, default: false },
    delegatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    delegationNote: { type: String, default: '' },
  },
  { timestamps: true }
);

approvalSchema.index({ tenantId: 1, taskId: 1, state: 1 });
approvalSchema.index({ tenantId: 1, approver: 1, state: 1 });
approvalSchema.index({ tenantId: 1, state: 1, dueAt: 1 });

module.exports = mongoose.models.CoreApproval || mongoose.model('CoreApproval', approvalSchema);
