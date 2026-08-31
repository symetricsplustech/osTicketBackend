const mongoose = require('mongoose');
const privacyAssessmentSchema = new mongoose.Schema({
  processingActivity: { type: String, required: true },
  dataCategories: [String], lawfulBasis: String,
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  mitigations: [String], dpiaRequired: Boolean,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.PrivacyAssessment || mongoose.model('PrivacyAssessment', privacyAssessmentSchema);
