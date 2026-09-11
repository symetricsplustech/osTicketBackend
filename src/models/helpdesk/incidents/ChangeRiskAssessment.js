const mongoose = require('mongoose');

const changeRiskAssessmentSchema = new mongoose.Schema(
  {
    change: { type: mongoose.Schema.Types.ObjectId, ref: 'Change', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    overallRisk: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    riskScore: { type: Number, default: 0 },
    impactScore: { type: Number, default: 0 },
    probabilityScore: { type: Number, default: 0 },
    mitigations: [{ type: String }],
    contingencies: [{ type: String }],
    assessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assessedAt: { type: Date, default: Date.now },
    conditions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChangeRiskCondition' }],
    isApproved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

changeRiskAssessmentSchema.index({ company: 1, change: 1 }, { unique: true });

module.exports = mongoose.model('ChangeRiskAssessment', changeRiskAssessmentSchema);
