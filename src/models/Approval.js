const mongoose = require('mongoose');

const approvalStepSchema = new mongoose.Schema(
  {
    order: { type: Number, default: 1 },
    assigneeType: {
      type: String,
      enum: ['agent', 'role', 'team', 'dept_manager', 'org_manager', 'any_admin'],
      default: 'agent',
    },
    assignee: { type: mongoose.Schema.Types.ObjectId, default: null },
    mode: { type: String, enum: ['approve', 'reject', 'acknowledge'], default: 'approve' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'skipped', 'expired', 'delegated'],
      default: 'pending',
    },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    decidedByName: { type: String, default: '' },
    decidedAt: { type: Date, default: null },
    comment: { type: String, default: '' },
    delegatedFrom: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { _id: false }
);

const approvalSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    refType: {
      type: String,
      enum: ['ticket', 'change', 'incident', 'problem', 'asset', 'contract', 'service_request', 'other'],
      default: 'other',
    },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    steps: { type: [approvalStepSchema], default: [] },
    mode: { type: String, enum: ['sequential', 'parallel'], default: 'sequential' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired', 'cancelled'],
      default: 'pending',
    },
    timeoutHours: { type: Number, default: 24 },
    autoApproveAfterHours: { type: Number, default: 0 },
    autoApproveResult: { type: String, enum: ['approved', 'rejected'], default: 'approved' },
    escalationAfterHours: { type: Number, default: 0 },
    escalateTo: { type: mongoose.Schema.Types.ObjectId, default: null }, // agent id
    condition: { type: mongoose.Schema.Types.Mixed, default: null }, // conditional approval
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    initiatedByName: { type: String, default: '' },
    completedAt: { type: Date, default: null },
    result: { type: String, default: '' },
  },
  { timestamps: true }
);

approvalSchema.index({ company: 1, status: 1, createdAt: -1 });
approvalSchema.index({ company: 1, refType: 1, refId: 1 });

module.exports = mongoose.model('Approval', approvalSchema);