const mongoose = require('mongoose');

const changeModelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['normal', 'standard', 'emergency', 'registration'], required: true },
    defaultRisk: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    requiredApprovals: { type: Number, default: 1, min: 0 },
    requiresCAB: { type: Boolean, default: false },
    requiresRiskAssessment: { type: Boolean, default: true },
    autoAssign: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    slaProfile: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

changeModelSchema.index({ company: 1, type: 1 });

module.exports = mongoose.model('ChangeModel', changeModelSchema);
