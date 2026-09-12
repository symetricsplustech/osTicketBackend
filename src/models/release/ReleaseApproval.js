const { Schema, model } = require('mongoose');
const ReleaseApprovalSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  releaseId: { type: Schema.Types.ObjectId, ref: 'Release', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  number: { type: String, required: true, unique: true },
  type: { type: String, enum: ['readiness', 'deployment', 'rollback', 'go_no_go', 'post_deployment', 'emergency'], default: 'readiness', index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired'], default: 'pending', index: true },
  approverIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  requiredApprovals: { type: Number, default: 1 },
  currentApprovals: { type: Number, default: 0 },
  currentRejections: { type: Number, default: 0 },
  approvers: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'delegated'], default: 'pending' },
    decidedAt: { type: Date },
    comment: { type: String, trim: true, default: '' },
    delegatedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  }],
  criteria: { type: String, trim: true, default: '' },
  decidedAt: { type: Date },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date },
  autoApproveOnTimeout: { type: Boolean, default: false },
  autoApproveResult: { type: String, enum: ['approve', 'reject'], default: 'approve' },
  escalationPolicyId: { type: Schema.Types.ObjectId, ref: 'EscalationPolicy' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
ReleaseApprovalSchema.index({ tenantId: 1, releaseId: 1, status: 1 });
ReleaseApprovalSchema.index({ tenantId: 1, 'approvers.userId': 1, status: 1 });
module.exports = model('ReleaseApproval', ReleaseApprovalSchema);
