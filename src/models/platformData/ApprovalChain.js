const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const approvalChainSchema = new mongoose.Schema({
  entityType: String, entityId: mongoose.Schema.Types.ObjectId,
  steps: [{ approverRole: String, decidedBy: oid, decision: String, decidedAt: Date }],
  mode: { type: String, enum: ['sequential', 'all_of', 'any_of'], default: 'sequential' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ApprovalChain || mongoose.model('ApprovalChain', approvalChainSchema);
