const mongoose = require('mongoose');
const thirdPartySchema = new mongoose.Schema({
  name: { type: String, required: true },
  tier: { type: String, enum: ['critical', 'high', 'moderate', 'low'], default: 'moderate' },
  servicesProvided: String,
  questionnaireSent: Date,
  questionnaireReturned: Date,
  inherentRisk: Number,
  residualRisk: Number,
  assessmentStatus: { type: String, enum: ['not_started', 'in_progress', 'complete'], default: 'not_started' },
  contracts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contract' }],
  nextReviewDate: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ThirdParty || mongoose.model('ThirdParty', thirdPartySchema);
