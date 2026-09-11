const mongoose = require('mongoose');

const changeApprovalPolicySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    description: { type: String, default: '' },
    changeType: { type: String, enum: ['normal', 'standard', 'emergency', 'registration', 'any'], default: 'any' },
    riskThreshold: { type: String, enum: ['low', 'medium', 'high', 'critical', 'any'], default: 'any' },
    requireCAB: { type: Boolean, default: false },
    approvers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    approvalGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    requiredApprovals: { type: Number, default: 1 },
    autoApproveBelowRisk: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: null },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

changeApprovalPolicySchema.index({ company: 1, isActive: 1 });

module.exports = mongoose.model('ChangeApprovalPolicy', changeApprovalPolicySchema);
