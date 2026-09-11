const { Schema, model } = require('mongoose');
const DelegationSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  delegatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  delegateId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reason: { type: String, trim: true, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true, index: true },
  scopes: {
    allApprovals: { type: Boolean, default: true },
    entityTypes: [{ type: String }],
    specificEntities: [{ type: Schema.Types.ObjectId }],
  },
  approvalsDelegated: { type: Number, default: 0 },
  lastDelegatedAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
DelegationSchema.index({ tenantId: 1, delegatorId: 1, isActive: 1 });
DelegationSchema.index({ tenantId: 1, delegateId: 1, isActive: 1 });
module.exports = model('Delegation', DelegationSchema);
