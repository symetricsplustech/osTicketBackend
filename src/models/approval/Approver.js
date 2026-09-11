const { Schema, model } = require('mongoose');
const ApproverSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  stepId: { type: Schema.Types.ObjectId, ref: 'ApprovalStep', required: true, index: true },
  instanceId: { type: Schema.Types.ObjectId, ref: 'ApprovalInstance', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName: { type: String, default: '' },
  role: { type: String, enum: ['approver', 'reviewer', 'acknowledger'], default: 'approver' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'skipped', 'expired', 'delegated'], default: 'pending', index: true },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  decidedAt: { type: Date },
  comment: { type: String, trim: true, default: '' },
  delegatedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  delegationNote: { type: String, default: '' },
  escalationLevel: { type: Number, default: 0 },
  dueAt: { type: Date },
  order: { type: Number, default: 0 },
  meta: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
ApproverSchema.index({ tenantId: 1, stepId: 1, userId: 1 });
module.exports = model('Approver', ApproverSchema);
