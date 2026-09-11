/**
 * RequestApproval — approval record linked to a Request or RequestedItem.
 * Supports sequential/parallel approval chains with escalation.
 */
const { Schema, model } = require('mongoose');

const RequestApprovalSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  requestedItemId: { type: Schema.Types.ObjectId, ref: 'RequestedItem', required: true, index: true },
  requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, index: true },

  // Approval chain
  mode: { type: String, enum: ['sequential', 'parallel'], default: 'sequential' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'escalated', 'cancelled'], default: 'pending', index: true },
  type: { type: String, enum: ['individual', 'group', 'sequential', 'parallel'], default: 'individual' },

  // Approvers
  approvers: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    role: { type: String, enum: ['approver', 'reviewer', 'acknowledger'] },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'skipped', 'delegated'], default: 'pending' },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    comment: { type: String },
    delegatedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    escalationLevel: { type: Number, default: 0 },
  }],

  requiredApprovals: { type: Number, default: 1 },
  approvalCount: { type: Number, default: 0 },
  rejectionCount: { type: Number, default: 0 },

  // Timeout & escalation
  timeoutHours: { type: Number },
  autoApproveAfterHours: { type: Number },
  autoApproveResult: { type: String, enum: ['approved', 'rejected'] },
  escalationAfterHours: { type: Number },
  escalateTo: { type: Schema.Types.ObjectId, ref: 'User' },

  // Conditions
  condition: { type: Schema.Types.Mixed, default: {} },

  // Lifecycle
  initiatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  completedAt: { type: Date },
  result: { type: String, enum: ['approved', 'rejected', 'escalated'] },

  meta: { type: Schema.Types.Mixed, default: {} },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

RequestApprovalSchema.index({ tenantId: 1, requestedItemId: 1, status: 1, isDeleted: 1 });

module.exports = model('RequestApproval', RequestApprovalSchema);
