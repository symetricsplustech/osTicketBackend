const { Schema, model } = require('mongoose');
const ApprovalDefinitionSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  number: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true, index: true },
  entityType: { type: String, enum: ['ticket', 'change', 'incident', 'problem', 'service_request', 'asset', 'contract', 'knowledge', 'task', 'any'], required: true, index: true },
  conditions: {
    matchAll: { type: Boolean, default: true },
    rules: [{
      field: { type: String, required: true },
      operator: { type: String, required: true },
      value: { type: Schema.Types.Mixed },
    }],
  },
  approvalMode: { type: String, enum: ['sequential', 'parallel', 'any'], default: 'sequential' },
  requiredApprovals: { type: Number, default: 1, min: 1 },
  steps: [{
    order: { type: Number, required: true },
    name: { type: String, default: '' },
    assigneeType: { type: String, enum: ['agent', 'role', 'team', 'dept_manager', 'org_manager', 'any_admin', 'custom'], required: true },
    assignee: { type: Schema.Types.ObjectId },
    mode: { type: String, enum: ['approve', 'reject', 'acknowledge'], default: 'approve' },
    timeoutHours: { type: Number, default: 0 },
    autoApproveOnTimeout: { type: Boolean, default: false },
    required: { type: Boolean, default: true },
  }],
  escalation: {
    enabled: { type: Boolean, default: false },
    afterHours: { type: Number, default: 24 },
    escalateTo: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: ['notify', 'reassign', 'auto_approve', 'auto_reject'], default: 'notify' },
  },
  timeout: {
    enabled: { type: Boolean, default: false },
    afterHours: { type: Number, default: 72 },
    action: { type: String, enum: ['auto_approve', 'auto_reject', 'notify_admin', 'escalate'], default: 'notify_admin' },
  },
  notification: {
    requestToApprovers: { type: Boolean, default: true },
    requestToRequester: { type: Boolean, default: true },
    decisionToRequester: { type: Boolean, default: true },
    escalationToAdmin: { type: Boolean, default: true },
  },
  hitCount: { type: Number, default: 0 },
  lastHitAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
ApprovalDefinitionSchema.index({ tenantId: 1, isActive: 1, entityType: 1, isDeleted: 1 });
module.exports = model('ApprovalDefinition', ApprovalDefinitionSchema);
